// Overlay tile renderers (#71): z-stacking overlay, modal/drawer/popover
// surfaces, and tooltip.

import { applyContainerProps, type TileCtx, type TileNode, type TileRenderers } from "./core.ts";

function appendChildren(el: HTMLElement, children: TileNode[], ctx: TileCtx): void {
  for (const child of children) {
    if (child != null) el.appendChild(ctx.render(child));
  }
}

/**
 * Place an overlay layer inside its `position: relative` container via flexbox.
 * The token combines a vertical part (`top` / `bottom`, default center) and a
 * horizontal part (`left` / `right`, default center), e.g. `top-left`,
 * `bottom`, `center`. Unknown parts fall back to center (consistent with how
 * other style-prop tokens pass through without compile-time validation).
 */
function applyOverlayAlign(layer: HTMLElement, align: string): void {
  const parts = align.split("-");
  const has = (k: string): boolean => parts.includes(k);
  layer.style.alignItems = has("top") ? "flex-start" : has("bottom") ? "flex-end" : "center";
  layer.style.justifyContent = has("left") ? "flex-start" : has("right") ? "flex-end" : "center";
}

export const overlayTiles: TileRenderers = {
  overlay(node, ctx) {
    // z-axis stacking: child[0] is the base layer (normal flow); later
    // children are each wrapped in an absolutely-positioned layer covering
    // the container, placed by the `align` prop. The base layer's layout is
    // unaffected by the overlays (they are out of flow).
    const div = document.createElement("div");
    div.dataset.kumikiTile = "overlay";
    div.style.position = "relative";
    applyContainerProps(div, node.props);
    const align = typeof node.props?.align === "string" ? (node.props.align as string) : "center";
    const kids = node.children.filter((c): c is TileNode => c != null);
    kids.forEach((child, i) => {
      if (i === 0) {
        div.appendChild(ctx.render(child));
        return;
      }
      const layer = document.createElement("div");
      layer.dataset.kumikiTile = "overlay-layer";
      layer.style.position = "absolute";
      layer.style.inset = "0";
      layer.style.display = "flex";
      applyOverlayAlign(layer, align);
      layer.appendChild(ctx.render(child));
      div.appendChild(layer);
    });
    return div;
  },
  modal: renderSurface,
  drawer: renderSurface,
  popover: renderSurface,
  tooltip(node, ctx) {
    const span = document.createElement("span");
    span.dataset.kumikiTile = "tooltip";
    if (node.text) span.title = node.text;
    if (node.placement) span.dataset.placement = node.placement;
    appendChildren(span, node.children, ctx);
    return span;
  },
};

function renderSurface(
  node: TileNode & { kind: "modal" | "drawer" | "popover" },
  ctx: TileCtx,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.dataset.kumikiTile = node.kind;
  // `open=false` renders a present-but-hidden host so toggling open/closed
  // is a style flip, not a mount/unmount — and smoke still "renders".
  if (node.open === false) wrap.style.display = "none";
  if (node.kind === "modal") {
    wrap.style.position = "fixed";
    wrap.style.inset = "0";
    wrap.style.display = node.open === false ? "none" : "flex";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "center";
    wrap.style.background = "rgba(0,0,0,0.4)";
  } else if (node.kind === "drawer") {
    wrap.style.position = "fixed";
    wrap.style.top = "0";
    wrap.style.bottom = "0";
    wrap.style[node.side === "right" ? "right" : "left"] = "0";
  }
  if (node.props?.onClose) {
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) node.props?.onClose?.(node.props?.el ?? {});
    });
  }
  const inner = document.createElement("div");
  inner.dataset.kumikiTile = `${node.kind}-content`;
  inner.style.background = "#fff";
  if (node.title) {
    const h = document.createElement("h2");
    h.textContent = node.title;
    inner.appendChild(h);
  }
  appendChildren(inner, node.children, ctx);
  wrap.appendChild(inner);
  return wrap;
}
