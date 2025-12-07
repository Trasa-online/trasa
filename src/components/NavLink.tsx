import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface NavLinkRenderProps {
  isActive: boolean;
  isPending: boolean;
  isTransitioning: boolean;
}

interface NavLinkCompatProps extends Omit<NavLinkProps, "className" | "children"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  children?: ReactNode | ((props: NavLinkRenderProps) => ReactNode);
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, children, ...props }, ref) => {
    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        {...props}
      >
        {({ isActive, isPending, isTransitioning }) =>
          typeof children === 'function'
            ? children({ isActive, isPending, isTransitioning })
            : children
        }
      </RouterNavLink>
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
