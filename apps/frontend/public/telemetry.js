((window) => {
    const {
        screen: { width, height },
        navigator: { language },
        location,
        document,
        history,
    } = window;
    const { hostname, href, origin } = location;
    const { currentScript, referrer } = document;
    const localStorage = href.startsWith("data:") ? undefined : window.localStorage;

    if (hostname.includes("localhost")) return;

    if (!currentScript) return;

    const _data = "data-";
    const _false = "false";
    const _true = "true";
    const attr = currentScript.getAttribute.bind(currentScript);
    const website = attr(`${_data}website-id`);
    const tag = attr(`${_data}tag`);
    const autoTrack = attr(`${_data}auto-track`) !== _false;
    const excludeSearch = attr(`${_data}exclude-search`) === _true;
    const excludeHash = attr(`${_data}exclude-hash`) === _true;
    const domain = attr(`${_data}domains`) || "";
    const domains = domain.split(",").map((n) => n.trim());
    const endpoint = "https://api-gateway.umami.dev/api/send";
    const screen = `${width}x${height}`;
    const eventRegex = /data-umami-event-([\w-_]+)/;
    const eventNameAttribute = `${_data}umami-event`;
    const delayDuration = 300;

    /* Helper functions */

    function encode(str) {
        if (!str) {
            return undefined;
        }

        try {
            const result = decodeURI(str);

            if (result !== str) {
                return result;
            }
        } catch (e) {
            return str;
        }

        return encodeURI(str);
    }

    function parseURL(url) {
        try {
            // use location.origin as the base to handle cases where the url is a relative path
            const { pathname, search, hash } = new URL(url, origin);
            url = pathname + search + hash;
        } catch {
            url = "";
        }

        if (excludeSearch) url = url.split("?")[0];
        if (excludeHash) url = url.split("#")[0];
        return url;
    }

    function getPayload() {
        return {
            website,
            hostname,
            screen,
            language,
            title: encode(title),
            url: encode(currentUrl),
            referrer: encode(currentRef),
            tag: tag ? tag : undefined,
        };
    }

    /* Event handlers */
    function handlePush(state, title, url) {
        if (!url) return;
        currentRef = currentUrl;
        currentUrl = parseURL(url.toString());

        if (currentUrl !== currentRef) {
            setTimeout(track, delayDuration);
        }
    }

    function handlePathChanges() {
        function hook(_this, method, callback) {
            const orig = _this[method];

            return (...args) => {
                callback.apply(null, args);

                return orig.apply(_this, args);
            };
        }

        history.pushState = hook(history, "pushState", handlePush);
        history.replaceState = hook(history, "replaceState", handlePush);
    }

    function handleTitleChanges() {
        const observer = new MutationObserver(([entry]) => {
            title = entry?.target ? entry.target.text : undefined;
        });

        const node = document.querySelector("head > title");

        if (node) {
            observer.observe(node, {
                subtree: true,
                characterData: true,
                childList: true,
            });
        }
    }

    function handleClicks() {
        document.addEventListener(
            "click",
            async (e) => {
                function isSpecialTag(tagName) {
                    return ["BUTTON", "A"].includes(tagName);
                }

                async function trackElement(el) {
                    const attr = el.getAttribute.bind(el);
                    const eventName = attr(eventNameAttribute);

                    if (eventName) {
                        const eventData = {};

                        for (const name of el.getAttributeNames()) {
                            const match = name.match(eventRegex);

                            if (match) {
                                eventData[match[1]] = attr(name);
                            }
                        }

                        return track(eventName, eventData);
                    }
                }

                function findParentTag(rootElem, maxSearchDepth) {
                    let currentElement = rootElem;
                    for (let i = 0; i < maxSearchDepth; i++) {
                        if (isSpecialTag(currentElement.tagName)) {
                            return currentElement;
                        }
                        currentElement = currentElement.parentElement;
                        if (!currentElement) {
                            return null;
                        }
                    }
                }

                const el = e.target;
                const parentElement = isSpecialTag(el.tagName) ? el : findParentTag(el, 10);

                if (parentElement) {
                    const { href, target } = parentElement;
                    const eventName = parentElement.getAttribute(eventNameAttribute);

                    if (eventName) {
                        if (parentElement.tagName === "A") {
                            const external = target === "_blank" || e.ctrlKey || e.shiftKey || e.metaKey || (e.button && e.button === 1);

                            if (eventName && href) {
                                if (!external) {
                                    e.preventDefault();
                                }
                                return trackElement(parentElement).then(() => {
                                    if (!external) location.href = href;
                                });
                            }
                        } else if (parentElement.tagName === "BUTTON") {
                            return trackElement(parentElement);
                        }
                    }
                } else {
                    return trackElement(el);
                }
            },
            true
        );
    }

    /* Tracking functions */

    function trackingDisabled() {
        return !website || localStorage?.getItem("umami.disabled") || (domain && !domains.includes(hostname));
    }

    async function send(payload, type = "event") {
        if (trackingDisabled()) return;

        const headers = {
            "Content-Type": "application/json",
        };

        if (typeof cache !== "undefined") {
            headers["x-umami-cache"] = cache;
        }

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                body: JSON.stringify({ type, payload }),
                headers,
            });
            const text = await res.text();

            cache = text;
            return cache;
        } catch (e) {
            /* empty */
        }
    }

    function init() {
        if (!initialized) {
            track();
            handlePathChanges();
            handleTitleChanges();
            handleClicks();
            initialized = true;
        }
    }

    function track(obj, data) {
        if (typeof obj === "string") {
            return send({
                ...getPayload(),
                name: obj,
                data: typeof data === "object" ? data : undefined,
            });
        }
        if (typeof obj === "object") {
            return send(obj);
        }
        if (typeof obj === "function") {
            return send(obj(getPayload()));
        }
        return send(getPayload());
    }

    function identify(data) {
        return send({ ...getPayload(), data }, "identify");
    }

    /* Start */

    if (!window.umami) {
        window.umami = {
            track,
            identify,
        };
    }

    let currentUrl = parseURL(href);
    let currentRef = referrer.startsWith(origin) ? "" : referrer;
    let title = document.title;
    let cache;
    let initialized;

    if (autoTrack && !trackingDisabled()) {
        if (document.readyState === "complete") {
            init();
        } else {
            document.addEventListener("readystatechange", init, true);
        }
    }
})(window);
