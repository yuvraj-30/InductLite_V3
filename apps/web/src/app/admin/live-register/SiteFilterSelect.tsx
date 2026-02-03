"use client";
import React from "react";

interface SiteFilterSelectProps {
  sites: { id: string; name: string }[];
  siteFilter: string | undefined;
}

export function SiteFilterSelect({ sites, siteFilter }: SiteFilterSelectProps) {
  return (
    <select
      name="site"
      id="site"
      defaultValue={siteFilter || ""}
      className="block w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
      onChange={(e) => {
        const url = new URL(window.location.href);
        if (e.target.value) {
          url.searchParams.set("site", e.target.value);
        } else {
          url.searchParams.delete("site");
        }
        window.location.href = url.toString();
      }}
    >
      <option value="">All Sites</option>
      {sites.map((site) => (
        <option key={site.id} value={site.id}>
          {site.name}
        </option>
      ))}
    </select>
  );
}
