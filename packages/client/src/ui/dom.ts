export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  children?: (Node | string)[],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (children) {
    for (const child of children) {
      node.append(child instanceof Node ? child : document.createTextNode(child));
    }
  }
  return node;
}

export function button(label: string, className?: string): HTMLButtonElement {
  const b = el("button", className, [label]);
  return b;
}
