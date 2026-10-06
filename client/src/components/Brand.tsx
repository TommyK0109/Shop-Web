import { Link } from "react-router-dom";
import { Icon } from "./Icon";

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Storefront home">
      <span className="brand-mark">
        <Icon name="bag" />
      </span>
      <span>
        storefront<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
