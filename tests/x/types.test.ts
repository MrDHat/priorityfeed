import { describe, expect, it } from "vitest";
import type { Me } from "../../src/x/types.js";

describe("Me", () => {
  it("carries the fields we gate reads on", () => {
    const me: Me = { id: "2244994945", username: "bob", name: "Bob" };
    expect(me.id).toBe("2244994945");
    expect(me.username).toBe("bob");
  });
});