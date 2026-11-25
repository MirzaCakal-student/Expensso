import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Expensso",
    short_name: "Expensso",
    description: "Track what comes in and where it goes.",
    start_url: "/",
    display: "standalone",
    background_color: "#edf0ee",
    theme_color: "#10262b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
