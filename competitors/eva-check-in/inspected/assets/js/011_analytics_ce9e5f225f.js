if (typeof StorylaneUtils != "object") {
  var StorylaneUtils = {
    isBuffer: function (obj) {
      return (
        obj &&
        obj.constructor &&
        typeof obj.constructor.isBuffer === "function" &&
        obj.constructor.isBuffer(obj)
      );
    },

    keyIdentity: function (key) {
      return key;
    },

    flatten: function (target, opts) {
      opts = opts || {};

      const delimiter = opts.delimiter || ".";
      const maxDepth = opts.maxDepth;
      const transformKey = opts.transformKey || StorylaneUtils.keyIdentity;
      const output = {};

      function step(object, prev, currentDepth) {
        currentDepth = currentDepth || 1;
        Object.keys(object).forEach(function (key) {
          const value = object[key];
          const isarray = opts.safe && Array.isArray(value);
          const type = Object.prototype.toString.call(value);
          const isbuffer = StorylaneUtils.isBuffer(value);
          const isobject =
            type === "[object Object]" || type === "[object Array]";

          const newKey = prev
            ? prev + delimiter + transformKey(key)
            : transformKey(key);

          if (
            !isarray &&
            !isbuffer &&
            isobject &&
            Object.keys(value).length &&
            (!opts.maxDepth || currentDepth < maxDepth)
          ) {
            return step(value, newKey, currentDepth + 1);
          }

          output[newKey] = value;
        });
      }

      step(target);

      return output;
    },
  };
}

if (typeof StorylaneAnalytics != "object") {
  var sl_ga = false;
  var sl_amplitude = false;
  var sl_segment = false;

  var StorylaneAnalytics = {
    GA: function (payload) {
      // Google Analytics
      let sl_event = payload;
      sl_event.event = "sl_" + sl_event.event;
      let sl_event_data = StorylaneUtils.flatten(sl_event, { delimiter: "_" });
      if (sl_ga === "ga4") {
        window.sl_gtag("event", sl_event.event, sl_event_data);
      } else if (sl_ga === "gtag") {
        window.gtag("event", sl_event.event, sl_event_data);
      }
      // End Google Analytics
    },
    AMPLITUDE: function (payload) {
      // Amplitude
      let sl_event = payload;
      sl_event.event = "sl_" + sl_event.event;
      let sl_event_data = StorylaneUtils.flatten(sl_event, { delimiter: "_" });
      window.amplitude.logEvent(sl_event.event, sl_event_data);
    },
    SEGMENT: function (payload) {
      // Segment
      let sl_event = payload;
      sl_event.event = "sl_" + sl_event.event;
      let sl_event_data = StorylaneUtils.flatten(sl_event, { delimiter: "_" });
      window.analytics.track(sl_event.event, sl_event_data);
    },
  };

  // GA4 Setup
  var sl_script = document.querySelector('script[src*="storylane.js"]');
  if (sl_script) {
    const data_measurement_analytics_id =
      sl_script.getAttribute("measurement-id") ||
      sl_script.getAttribute("data-measurement-id");

    const data_amplitude_analytics_id =
      sl_script.getAttribute("amplitude-id") ||
      sl_script.getAttribute("data-amplitude-id");

    const data_segment_analytics_id =
      sl_script.getAttribute("segment-id") ||
      sl_script.getAttribute("data-segment-id");

    var sl_data_ga = sl_script.getAttribute("data-sl-ga");

    if (data_measurement_analytics_id) {
      sl_ga = "ga4";

      // Add GA Script
      var sl_ga_script = document.createElement("script");
      sl_ga_script.setAttribute("async", "");
      sl_ga_script.setAttribute(
        "src",
        "https://www.googletagmanager.com/gtag/js?id=" +
          data_measurement_analytics_id
      );
      document.head.appendChild(sl_ga_script);

      var sl_ga_gtag = document.createElement("script");
      var sl_ga_gtag_script = `
        window.dataLayer = window.dataLayer || [];
        function sl_gtag(){dataLayer.push(arguments);}
        sl_gtag('js', new Date());
        sl_gtag('config', '${data_measurement_analytics_id}');
      `;
      sl_ga_gtag.innerHTML = sl_ga_gtag_script;
      document.head.appendChild(sl_ga_gtag);
      console.log("Syncing Storylane Events using ga4");
    } else if (sl_data_ga === "true" && window.gtag) {
      sl_ga = "gtag";
      console.log("Syncing Storylane Events using gtag");
    }

    if (data_amplitude_analytics_id) {
      var sl_amplitude_script = document.createElement("script");
      // module
      sl_amplitude_script.setAttribute("type", "module");
      sl_amplitude_script.setAttribute("async", "");
      sl_amplitude_script.innerHTML = `
        import * as amplitudeanalyticsBrowser from 'https://cdn.jsdelivr.net/npm/@amplitude/analytics-browser@2.3.8/+esm'

        amplitudeanalyticsBrowser.init("${data_amplitude_analytics_id}",{
          defaultTracking:false
        });

        window.amplitude=amplitudeanalyticsBrowser;
      `;

      sl_amplitude = true;

      document.body.appendChild(sl_amplitude_script);
      console.log("Syncing Storylane Events using Amplitude");
    }

    if (data_segment_analytics_id) {
      var sl_segment_script = document.createElement("script");
      // module
      sl_segment_script.setAttribute("type", "module");
      sl_segment_script.setAttribute("async", "");
      sl_segment_script.innerHTML = `
        import { AnalyticsBrowser } from 'https://cdn.jsdelivr.net/npm/@segment/analytics-next@1.63.0/+esm'

        const analytics = AnalyticsBrowser.load({
          writeKey: '${data_segment_analytics_id}',
        })

        window.analytics=analytics;
      `;

      sl_segment = true;

      document.body.appendChild(sl_segment_script);
    }
  } else {
    console.log("Script not found for Storylane Events!");
  }

  window.addEventListener("message", (messageEvent) => {
    try {
      if (messageEvent.data.message === "storylane-demo-event") {
        if (sl_ga) {
          console.log("sending GA event");
          StorylaneAnalytics.GA(messageEvent.data.payload);
        }

        if (sl_amplitude) {
          console.log("sending Amplitude event");
          StorylaneAnalytics.AMPLITUDE(messageEvent.data.payload);
        }

        if (sl_segment) {
          console.log("sending Segment event");
          StorylaneAnalytics.SEGMENT(messageEvent.data.payload);
        }
      }
    } catch (error) {
      console.error(error);
    }
  });
}
