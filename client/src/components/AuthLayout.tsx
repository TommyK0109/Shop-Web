import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { shopImage } from "../lib/storefront";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <aside className="auth-aside">
        <span className="eyebrow">
          <Icon name="sparkle" width="14" height="14" /> YOUR EVERYDAY STARTS
          HERE
        </span>
        <h2>
          A place for
          <br />
          your next
          <br />
          <span>favorite thing.</span>
        </h2>
        <p>
          Keep your discoveries together, shop independent stores, and find a
          little joy in the everyday.
        </p>
        <img src={shopImage("home")} alt="A warm, thoughtfully styled home" />
      </aside>
      <div className="auth-panel">
        {children}
        <p className="auth-security">
          <Icon name="shield" width="14" height="14" /> Your password stays
          private and secure.
        </p>
      </div>
    </div>
  );
}
