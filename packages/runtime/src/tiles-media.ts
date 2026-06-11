// Media tile renderers (#71): image and video.

import type { TileRenderers } from "./core.ts";

export const mediaTiles: TileRenderers = {
  image(node) {
    const img = document.createElement("img");
    img.dataset.kumikiTile = "image";
    img.src = node.src;
    const alt = node.props?.alt;
    if (typeof alt === "string") img.alt = alt;
    return img;
  },
  video(node) {
    const v = document.createElement("video");
    v.dataset.kumikiTile = "video";
    if (node.src) v.src = node.src;
    if (node.controls) v.controls = true;
    if (node.autoplay) v.autoplay = true;
    return v;
  },
};
