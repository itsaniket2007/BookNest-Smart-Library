(function () {
  "use strict";

  async function request(path, options) {
    const settings = options || {};
    const headers = Object.assign({ "Accept": "application/json" }, settings.headers || {});
    if (settings.body && !(settings.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(path, {
      method: settings.method || "GET",
      credentials: "include",
      headers: headers,
      body: settings.body instanceof FormData ? settings.body : (settings.body ? JSON.stringify(settings.body) : undefined)
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (error) { data = { message: text }; }
    if (!response.ok) {
      const error = new Error(data.message || "Request failed.");
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  window.BookNestAPI = {
    request: request,
    get: function (path) { return request(path); },
    post: function (path, body) { return request(path, { method: "POST", body: body }); },
    put: function (path, body) { return request(path, { method: "PUT", body: body }); },
    patch: function (path, body) { return request(path, { method: "PATCH", body: body }); },
    del: function (path) { return request(path, { method: "DELETE" }); },
    upload: function (path, formData) { return request(path, { method: "POST", body: formData }); }
  };
}());
