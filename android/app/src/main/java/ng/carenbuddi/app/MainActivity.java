package ng.carenbuddi.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.res.AssetManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import java.io.ByteArrayInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Thin native shell around the CareNBuddi static web export.
 *
 * The whole Next.js build (out/) is bundled inside the APK and served from
 * https://appassets.androidplatform.net/ through WebViewAssetLoader, so every
 * screen, style and script opens instantly with no network. Anything that
 * genuinely lives on the internet (Pexels imagery, an optional Supabase
 * backend) still needs a connection.
 */
public class MainActivity extends Activity {

    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String APP_ORIGIN = "https://" + APP_HOST;
    private static final int FILE_CHOOSER_REQUEST = 1;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(false);

        WebView.setWebContentsDebuggingEnabled(
                (getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0);

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .setDomain(APP_HOST)
                .addPathHandler("/", new AppAssetsPathHandler(getAssets()))
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleNavigation(request.getUrl());
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                return openFileChooser(callback, params);
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            // The installed app opens straight into the product (/app); the
            // marketing website (/) stays a browser-only thing.
            webView.loadUrl(APP_ORIGIN + "/app");
        }
    }

    /** Routes non-http schemes to the system; everything else loads in place. */
    private boolean handleNavigation(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        if (APP_ORIGIN.equals(scheme + "://" + uri.getHost())) {
            return false;
        }
        if ("http".equals(scheme) || "https".equals(scheme)) {
            return false;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            // No app can handle it; swallow instead of crashing.
        }
        return true;
    }

    private boolean openFileChooser(ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
        }
        filePathCallback = callback;

        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        String[] accept = params.getAcceptTypes();
        intent.setType(accept != null && accept.length > 0 && accept[0] != null && !accept[0].isEmpty()
                ? accept[0] : "*/*");
        if (params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        }
        try {
            startActivityForResult(Intent.createChooser(intent, "Select file"), FILE_CHOOSER_REQUEST);
            return true;
        } catch (ActivityNotFoundException e) {
            filePathCallback = null;
            return false;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST && filePathCallback != null) {
            List<Uri> uris = new ArrayList<>();
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    ClipData clip = data.getClipData();
                    for (int i = 0; i < clip.getItemCount(); i++) {
                        uris.add(clip.getItemAt(i).getUri());
                    }
                } else if (data.getData() != null) {
                    uris.add(data.getData());
                }
            }
            Uri[] results = uris.isEmpty() ? null : uris.toArray(new Uri[0]);
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onPause() {
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }

    /**
     * Serves the bundled export out of the APK with the small adaptations a
     * native container needs:
     *  - "/profile" also resolves to "profile.html" (Next export is flat);
     *  - the PWA service worker is replaced with a no-op so stale cached HTML
     *    can never mask an app update;
     *  - HTML/TXT responses are no-store so a new APK always shows new code.
     */
    private static final class AppAssetsPathHandler implements WebViewAssetLoader.PathHandler {

        private static final String NO_OP_SW =
                "self.addEventListener('install',function(e){self.skipWaiting();});"
                        + "self.addEventListener('fetch',function(){});";

        private final AssetManager assets;

        AppAssetsPathHandler(AssetManager assets) {
            this.assets = assets;
        }

        @Override
        public WebResourceResponse handle(String path) {
            String clean = (path == null || path.isEmpty()) ? "/" : path;

            if ("/sw.js".equals(clean)) {
                return textResponse("application/javascript", NO_OP_SW, "no-store");
            }

            String assetPath = toAssetPath(clean);
            try {
                InputStream stream = assets.open(assetPath);
                String mime = mimeFor(assetPath);
                boolean htmlLike = assetPath.endsWith(".html") || assetPath.endsWith(".txt");
                Map<String, String> headers = new HashMap<>();
                headers.put("Cache-Control", htmlLike ? "no-store" : "public, max-age=31536000");
                String encoding = isText(mime) ? "UTF-8" : null;
                return new WebResourceResponse(mime, encoding, 200, "OK", headers, stream);
            } catch (FileNotFoundException missing) {
                try {
                    InputStream notFound = assets.open("404.html");
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Cache-Control", "no-store");
                    return new WebResourceResponse("text/html", "UTF-8", 404, "Not Found", headers, notFound);
                } catch (IOException impossible) {
                    return textResponse("text/plain", "Not found.", "no-store");
                }
            } catch (IOException error) {
                return textResponse("text/plain", "Error opening asset.", "no-store");
            }
        }

        /** Maps a URL path to a bundled file, trying the export's flat .html layout. */
        private String toAssetPath(String path) {
            String p = path.startsWith("/") ? path.substring(1) : path;
            if (p.isEmpty()) {
                return "index.html";
            }
            String[] candidates = new String[] {
                    p,
                    p + ".html",
                    p + "/index.html",
                    stripTrailingSlash(p) + ".html",
                    stripTrailingSlash(p) + "/index.html",
            };
            for (String candidate : candidates) {
                if (!candidate.endsWith("/") && exists(candidate)) {
                    return candidate;
                }
            }
            return p;
        }

        private String stripTrailingSlash(String value) {
            return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
        }

        private boolean exists(String assetPath) {
            try (InputStream in = assets.open(assetPath)) {
                return in != null;
            } catch (IOException e) {
                return false;
            }
        }

        private static WebResourceResponse textResponse(String mime, String body, String cacheControl) {
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", cacheControl);
            InputStream stream = new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8));
            return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, stream);
        }

        private static boolean isText(String mime) {
            return mime.startsWith("text/")
                    || mime.contains("javascript")
                    || mime.contains("json")
                    || mime.contains("xml")
                    || mime.contains("svg");
        }

        private static String mimeFor(String path) {
            int dot = path.lastIndexOf('.');
            String ext = dot >= 0 ? path.substring(dot + 1).toLowerCase() : "";
            switch (ext) {
                case "html": return "text/html";
                case "htm": return "text/html";
                case "txt": return "text/plain";
                case "js": return "application/javascript";
                case "mjs": return "application/javascript";
                case "css": return "text/css";
                case "json": return "application/json";
                case "map": return "application/json";
                case "png": return "image/png";
                case "jpg": return "image/jpeg";
                case "jpeg": return "image/jpeg";
                case "gif": return "image/gif";
                case "svg": return "image/svg+xml";
                case "ico": return "image/x-icon";
                case "webp": return "image/webp";
                case "avif": return "image/avif";
                case "woff": return "font/woff";
                case "woff2": return "font/woff2";
                case "ttf": return "font/ttf";
                case "otf": return "font/otf";
                case "webmanifest": return "application/manifest+json";
                case "xml": return "application/xml";
                case "mp4": return "video/mp4";
                case "webm": return "video/webm";
                case "mp3": return "audio/mpeg";
                case "wav": return "audio/wav";
                case "pdf": return "application/pdf";
                default: return "application/octet-stream";
            }
        }
    }
}
