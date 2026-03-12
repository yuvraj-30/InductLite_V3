(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/apps/web/src/components/ui/theme-preference.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DARK_MODE_QUERY",
    ()=>DARK_MODE_QUERY,
    "HIGH_CONTRAST_QUERY",
    ()=>HIGH_CONTRAST_QUERY,
    "THEME_PREFERENCE_CHANGE_EVENT",
    ()=>THEME_PREFERENCE_CHANGE_EVENT,
    "THEME_PREFERENCE_STORAGE_KEY",
    ()=>THEME_PREFERENCE_STORAGE_KEY,
    "resolveThemePreference",
    ()=>resolveThemePreference,
    "sanitizeThemePreference",
    ()=>sanitizeThemePreference
]);
const THEME_PREFERENCE_STORAGE_KEY = "inductlite-theme-preference";
const THEME_PREFERENCE_CHANGE_EVENT = "inductlite-theme-preference-change";
const DARK_MODE_QUERY = "(prefers-color-scheme: dark)";
const HIGH_CONTRAST_QUERY = "(prefers-contrast: more)";
function sanitizeThemePreference(value) {
    if (value === "light" || value === "dark" || value === "auto") {
        return value;
    }
    return "auto";
}
function resolveThemePreference(preference, prefersDark, prefersHighContrast) {
    if (preference === "light") return "warm-light";
    if (preference === "dark") return "high-contrast-dark";
    return prefersDark || prefersHighContrast ? "high-contrast-dark" : "warm-light";
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/components/ui/theme-runtime.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ThemeRuntime",
    ()=>ThemeRuntime
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$theme$2d$preference$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/theme-preference.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
"use client";
;
;
function listenMediaQuery(mediaQuery, callback) {
    if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", callback);
        return ()=>mediaQuery.removeEventListener("change", callback);
    }
    mediaQuery.addListener(callback);
    return ()=>mediaQuery.removeListener(callback);
}
function ThemeRuntime() {
    _s();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ThemeRuntime.useEffect": ()=>{
            const root = document.documentElement;
            const darkMode = window.matchMedia(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$theme$2d$preference$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DARK_MODE_QUERY"]);
            const highContrast = window.matchMedia(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$theme$2d$preference$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HIGH_CONTRAST_QUERY"]);
            let preference = "auto";
            try {
                preference = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$theme$2d$preference$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sanitizeThemePreference"])(window.localStorage.getItem(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$theme$2d$preference$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["THEME_PREFERENCE_STORAGE_KEY"]));
            } catch  {
                preference = "auto";
            }
            const applyMode = {
                "ThemeRuntime.useEffect.applyMode": ()=>{
                    const resolvedTheme = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$theme$2d$preference$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveThemePreference"])(preference, darkMode.matches, highContrast.matches);
                    root.dataset.theme = resolvedTheme;
                    root.classList.toggle("dark", resolvedTheme === "high-contrast-dark");
                }
            }["ThemeRuntime.useEffect.applyMode"];
            const handlePreferenceChange = {
                "ThemeRuntime.useEffect.handlePreferenceChange": (event)=>{
                    const customEvent = event;
                    preference = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$theme$2d$preference$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sanitizeThemePreference"])(customEvent.detail?.preference);
                    applyMode();
                }
            }["ThemeRuntime.useEffect.handlePreferenceChange"];
            const handleStorageSync = {
                "ThemeRuntime.useEffect.handleStorageSync": (event)=>{
                    if (event.key !== __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$theme$2d$preference$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["THEME_PREFERENCE_STORAGE_KEY"]) return;
                    preference = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$theme$2d$preference$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sanitizeThemePreference"])(event.newValue);
                    applyMode();
                }
            }["ThemeRuntime.useEffect.handleStorageSync"];
            const handleMediaChange = {
                "ThemeRuntime.useEffect.handleMediaChange": ()=>{
                    if (preference !== "auto") return;
                    applyMode();
                }
            }["ThemeRuntime.useEffect.handleMediaChange"];
            applyMode();
            const unlistenDark = listenMediaQuery(darkMode, handleMediaChange);
            const unlistenContrast = listenMediaQuery(highContrast, handleMediaChange);
            window.addEventListener(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$theme$2d$preference$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["THEME_PREFERENCE_CHANGE_EVENT"], handlePreferenceChange);
            window.addEventListener("storage", handleStorageSync);
            let frame = 0;
            const updateScrollDepth = {
                "ThemeRuntime.useEffect.updateScrollDepth": ()=>{
                    if (frame !== 0) return;
                    frame = window.requestAnimationFrame({
                        "ThemeRuntime.useEffect.updateScrollDepth": ()=>{
                            frame = 0;
                            const maxScrollable = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
                            const depth = Math.min(1, Math.max(0, window.scrollY / maxScrollable));
                            root.style.setProperty("--scroll-depth", depth.toFixed(3));
                        }
                    }["ThemeRuntime.useEffect.updateScrollDepth"]);
                }
            }["ThemeRuntime.useEffect.updateScrollDepth"];
            updateScrollDepth();
            window.addEventListener("scroll", updateScrollDepth, {
                passive: true
            });
            window.addEventListener("resize", updateScrollDepth);
            return ({
                "ThemeRuntime.useEffect": ()=>{
                    if (frame !== 0) {
                        window.cancelAnimationFrame(frame);
                    }
                    unlistenDark();
                    unlistenContrast();
                    window.removeEventListener(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$theme$2d$preference$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["THEME_PREFERENCE_CHANGE_EVENT"], handlePreferenceChange);
                    window.removeEventListener("storage", handleStorageSync);
                    window.removeEventListener("scroll", updateScrollDepth);
                    window.removeEventListener("resize", updateScrollDepth);
                }
            })["ThemeRuntime.useEffect"];
        }
    }["ThemeRuntime.useEffect"], []);
    return null;
}
_s(ThemeRuntime, "OD7bBpZva5O2jO+Puf00hKivP7c=");
_c = ThemeRuntime;
var _c;
__turbopack_context__.k.register(_c, "ThemeRuntime");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/components/ui/theme-switcher.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ThemeSwitcher",
    ()=>ThemeSwitcher
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$theme$2d$preference$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/theme-preference.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
const OPTIONS = [
    {
        id: "auto",
        label: "Auto"
    },
    {
        id: "light",
        label: "Light"
    },
    {
        id: "dark",
        label: "Dark"
    }
];
function ThemeSwitcher() {
    _s();
    const [preference, setPreference] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("auto");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ThemeSwitcher.useEffect": ()=>{
            try {
                setPreference((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$theme$2d$preference$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sanitizeThemePreference"])(window.localStorage.getItem(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$theme$2d$preference$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["THEME_PREFERENCE_STORAGE_KEY"])));
            } catch  {
                setPreference("auto");
            }
        }
    }["ThemeSwitcher.useEffect"], []);
    const updatePreference = (next)=>{
        try {
            window.localStorage.setItem(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$theme$2d$preference$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["THEME_PREFERENCE_STORAGE_KEY"], next);
        } catch  {
        // Ignore storage errors in restricted browser modes.
        }
        window.dispatchEvent(new CustomEvent(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$theme$2d$preference$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["THEME_PREFERENCE_CHANGE_EVENT"], {
            detail: {
                preference: next
            }
        }));
        setPreference(next);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
        "aria-label": "Theme controls",
        className: "fixed bottom-4 right-4 z-[120] hidden rounded-xl border ring-soft bg-glass-strong p-1.5 shadow-float md:block",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "inline-flex items-center gap-1 rounded-lg border ring-soft bg-glass px-1 py-1",
            role: "group",
            "aria-label": "Theme mode",
            children: OPTIONS.map((option)=>{
                const active = preference === option.id;
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    type: "button",
                    onClick: ()=>updatePreference(option.id),
                    "aria-pressed": active,
                    className: `min-h-[36px] rounded-md px-2.5 text-xs font-semibold sm:text-sm ${active ? "bg-[color:var(--accent-primary)] text-white" : "text-secondary hover:bg-glass-strong hover:text-[color:var(--text-primary)]"}`,
                    children: option.label
                }, option.id, false, {
                    fileName: "[project]/apps/web/src/components/ui/theme-switcher.tsx",
                    lineNumber: 65,
                    columnNumber: 13
                }, this);
            })
        }, void 0, false, {
            fileName: "[project]/apps/web/src/components/ui/theme-switcher.tsx",
            lineNumber: 57,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/src/components/ui/theme-switcher.tsx",
        lineNumber: 53,
        columnNumber: 5
    }, this);
}
_s(ThemeSwitcher, "XHaZZJaoWOKb/1Fowie8NsK16fg=");
_c = ThemeSwitcher;
var _c;
__turbopack_context__.k.register(_c, "ThemeSwitcher");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/node_modules/next/dist/compiled/react/cjs/react-jsx-dev-runtime.development.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
/**
 * @license React
 * react-jsx-dev-runtime.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ "use strict";
"production" !== ("TURBOPACK compile-time value", "development") && function() {
    function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type) return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch(type){
            case REACT_FRAGMENT_TYPE:
                return "Fragment";
            case REACT_PROFILER_TYPE:
                return "Profiler";
            case REACT_STRICT_MODE_TYPE:
                return "StrictMode";
            case REACT_SUSPENSE_TYPE:
                return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
                return "SuspenseList";
            case REACT_ACTIVITY_TYPE:
                return "Activity";
            case REACT_VIEW_TRANSITION_TYPE:
                return "ViewTransition";
        }
        if ("object" === typeof type) switch("number" === typeof type.tag && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof){
            case REACT_PORTAL_TYPE:
                return "Portal";
            case REACT_CONTEXT_TYPE:
                return type.displayName || "Context";
            case REACT_CONSUMER_TYPE:
                return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
                var innerType = type.render;
                type = type.displayName;
                type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
                return type;
            case REACT_MEMO_TYPE:
                return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
                innerType = type._payload;
                type = type._init;
                try {
                    return getComponentNameFromType(type(innerType));
                } catch (x) {}
        }
        return null;
    }
    function testStringCoercion(value) {
        return "" + value;
    }
    function checkKeyStringCoercion(value) {
        try {
            testStringCoercion(value);
            var JSCompiler_inline_result = !1;
        } catch (e) {
            JSCompiler_inline_result = !0;
        }
        if (JSCompiler_inline_result) {
            JSCompiler_inline_result = console;
            var JSCompiler_temp_const = JSCompiler_inline_result.error;
            var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
            JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
            return testStringCoercion(value);
        }
    }
    function getTaskName(type) {
        if (type === REACT_FRAGMENT_TYPE) return "<>";
        if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE) return "<...>";
        try {
            var name = getComponentNameFromType(type);
            return name ? "<" + name + ">" : "<...>";
        } catch (x) {
            return "<...>";
        }
    }
    function getOwner() {
        var dispatcher = ReactSharedInternals.A;
        return null === dispatcher ? null : dispatcher.getOwner();
    }
    function UnknownOwner() {
        return Error("react-stack-top-frame");
    }
    function hasValidKey(config) {
        if (hasOwnProperty.call(config, "key")) {
            var getter = Object.getOwnPropertyDescriptor(config, "key").get;
            if (getter && getter.isReactWarning) return !1;
        }
        return void 0 !== config.key;
    }
    function defineKeyPropWarningGetter(props, displayName) {
        function warnAboutAccessingKey() {
            specialPropKeyWarningShown || (specialPropKeyWarningShown = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
        }
        warnAboutAccessingKey.isReactWarning = !0;
        Object.defineProperty(props, "key", {
            get: warnAboutAccessingKey,
            configurable: !0
        });
    }
    function elementRefGetterWithDeprecationWarning() {
        var componentName = getComponentNameFromType(this.type);
        didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
        componentName = this.props.ref;
        return void 0 !== componentName ? componentName : null;
    }
    function ReactElement(type, key, props, owner, debugStack, debugTask) {
        var refProp = props.ref;
        type = {
            $$typeof: REACT_ELEMENT_TYPE,
            type: type,
            key: key,
            props: props,
            _owner: owner
        };
        null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
            enumerable: !1,
            get: elementRefGetterWithDeprecationWarning
        }) : Object.defineProperty(type, "ref", {
            enumerable: !1,
            value: null
        });
        type._store = {};
        Object.defineProperty(type._store, "validated", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: 0
        });
        Object.defineProperty(type, "_debugInfo", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: null
        });
        Object.defineProperty(type, "_debugStack", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: debugStack
        });
        Object.defineProperty(type, "_debugTask", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: debugTask
        });
        Object.freeze && (Object.freeze(type.props), Object.freeze(type));
        return type;
    }
    function jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStack, debugTask) {
        var children = config.children;
        if (void 0 !== children) if (isStaticChildren) if (isArrayImpl(children)) {
            for(isStaticChildren = 0; isStaticChildren < children.length; isStaticChildren++)validateChildKeys(children[isStaticChildren]);
            Object.freeze && Object.freeze(children);
        } else console.error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
        else validateChildKeys(children);
        if (hasOwnProperty.call(config, "key")) {
            children = getComponentNameFromType(type);
            var keys = Object.keys(config).filter(function(k) {
                return "key" !== k;
            });
            isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
            didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error('A props object containing a "key" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />', isStaticChildren, children, keys, children), didWarnAboutKeySpread[children + isStaticChildren] = !0);
        }
        children = null;
        void 0 !== maybeKey && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
        hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
        if ("key" in config) {
            maybeKey = {};
            for(var propName in config)"key" !== propName && (maybeKey[propName] = config[propName]);
        } else maybeKey = config;
        children && defineKeyPropWarningGetter(maybeKey, "function" === typeof type ? type.displayName || type.name || "Unknown" : type);
        return ReactElement(type, children, maybeKey, getOwner(), debugStack, debugTask);
    }
    function validateChildKeys(node) {
        isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
    }
    function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    var React = __turbopack_context__.r("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"), REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_VIEW_TRANSITION_TYPE = Symbol.for("react.view_transition"), REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
        return null;
    };
    React = {
        react_stack_bottom_frame: function(callStackForError) {
            return callStackForError();
        }
    };
    var specialPropKeyWarningShown;
    var didWarnAboutElementRef = {};
    var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(React, UnknownOwner)();
    var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
    var didWarnAboutKeySpread = {};
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.jsxDEV = function(type, config, maybeKey, isStaticChildren) {
        var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
        if (trackActualOwner) {
            var previousStackTraceLimit = Error.stackTraceLimit;
            Error.stackTraceLimit = 10;
            var debugStackDEV = Error("react-stack-top-frame");
            Error.stackTraceLimit = previousStackTraceLimit;
        } else debugStackDEV = unknownOwnerDebugStack;
        return jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStackDEV, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
    };
}();
}),
"[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
'use strict';
if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
;
else {
    module.exports = __turbopack_context__.r("[project]/node_modules/next/dist/compiled/react/cjs/react-jsx-dev-runtime.development.js [app-client] (ecmascript)");
}
}),
]);

//# sourceMappingURL=_bcadb650._.js.map