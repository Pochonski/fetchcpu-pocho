// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { createTabs } from "../js/ui/tabs.js";

describe("tabs.js — createTabs", () => {
  let root;
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="tabs-root">
        <button class="tab" id="tab-one" role="tab" aria-controls="p1" aria-selected="true">One</button>
        <button class="tab" id="tab-two" role="tab" aria-controls="p2" aria-selected="false">Two</button>
        <div id="p1" role="tabpanel">Panel 1</div>
        <div id="p2" role="tabpanel" hidden>Panel 2</div>
      </div>
    `;
    root = document.querySelector(".tabs-root");
  });

  it("activate(i) toggles aria-selected and visibility", () => {
    const t = createTabs(root);
    t.activate(1);
    expect(root.querySelectorAll(".tab")[0].getAttribute("aria-selected")).toBe("false");
    expect(root.querySelectorAll(".tab")[1].getAttribute("aria-selected")).toBe("true");
    expect(document.getElementById("p1").hasAttribute("hidden")).toBe(true);
    expect(document.getElementById("p2").hasAttribute("hidden")).toBe(false);
  });

  it("activate(0) makes the first tab the active one", () => {
    const t = createTabs(root);
    t.activate(0);
    expect(root.querySelectorAll(".tab")[0].getAttribute("aria-selected")).toBe("true");
    expect(root.querySelectorAll(".tab")[1].getAttribute("aria-selected")).toBe("false");
  });

  it("clicking a tab fires tab:activate and switches panels", () => {
    createTabs(root);
    const events = [];
    root.addEventListener("tab:activate", (e) => events.push(e.detail));
    root.querySelectorAll(".tab")[1].click();
    expect(events).toEqual([{ index: 1, id: "tab-two" }]);
    expect(root.querySelectorAll(".tab")[1].getAttribute("aria-selected")).toBe("true");
  });
});