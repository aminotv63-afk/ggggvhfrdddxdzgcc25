/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "402b66900e731ca748771b6fc5e7a068"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "2692c2feb0ecd16b0e3af819e45f3562"
  }, {
    "url": "pwa-512x512.png",
    "revision": "1e5e7b814f5fd39d408c6061b5a0b476"
  }, {
    "url": "pwa-192x192.png",
    "revision": "3278d4ab2f25139ae1740ac20d4306c7"
  }, {
    "url": "index.html",
    "revision": "e35b3af58fafbd59902790805a3fedc4"
  }, {
    "url": "icon.svg",
    "revision": "f7a4f49dec4787bebd3f8970da76d9d7"
  }, {
    "url": "grab3d-cozy-knight.glb",
    "revision": "5459ef72a21ed8b159ffcd1a4733ba14"
  }, {
    "url": "grab3d-cozy-character.glb",
    "revision": "9c32a7eb025d5a463054ca3c97cef971"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "dc692b7cdd68b132b801dc4a48cb183f"
  }, {
    "url": "assets/sultan_plains_hero_1794563954369-Dqz3KFNR.jpg",
    "revision": null
  }, {
    "url": "assets/index-CwsgPbrc.css",
    "revision": null
  }, {
    "url": "assets/index-Cj9cWrDx.js",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_____-__-__-__-__-__-____com.cpuid.cpu_z_d1b5a488.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_____-__-__-__-__-__-____com.cpuid.cpu_z_6b1828a1.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_____-__-__-__-__-__-____com.cpuid.cpu_z_57fbed76.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_____-__-__-__-__-__-____com.android.settings_ac3750f5.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_____-__-__-__-__-__-____com.android.chrome_c6e0ec43.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_____-__-__-__-__-__-____com.android.chrome_41f769ff.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/IMG_________________2de462be.jpg",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "dc692b7cdd68b132b801dc4a48cb183f"
  }, {
    "url": "grab3d-cozy-character.glb",
    "revision": "9c32a7eb025d5a463054ca3c97cef971"
  }, {
    "url": "grab3d-cozy-knight.glb",
    "revision": "5459ef72a21ed8b159ffcd1a4733ba14"
  }, {
    "url": "icon.svg",
    "revision": "f7a4f49dec4787bebd3f8970da76d9d7"
  }, {
    "url": "pwa-192x192.png",
    "revision": "3278d4ab2f25139ae1740ac20d4306c7"
  }, {
    "url": "pwa-512x512.png",
    "revision": "1e5e7b814f5fd39d408c6061b5a0b476"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "2692c2feb0ecd16b0e3af819e45f3562"
  }, {
    "url": "manifest.webmanifest",
    "revision": "402c47d039693480d98ea1af74f203e4"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
