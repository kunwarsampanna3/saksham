import {
  ClipboardList,
  Compass,
  MessageSquare,
  Search,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Dict } from "@/lib/i18n/dict";

export interface NavLink {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** In the top bar only from 1440px, where it fits. Always in the menus. */
  wide?: boolean;
}

/** Main links in the top bar. They follow the mode: hiring shows hiring links, working shows work links. */
export function primaryNav(t: Dict, working: boolean): NavLink[] {
  return working
    ? [
        { href: "/explore", label: t.home.quick.findWork, Icon: Search },
        { href: "/my-tasks", label: t.home.quick.myOffers, Icon: ClipboardList },
        { href: "/wallet", label: t.home.quick.earnings, Icon: Wallet },
        { href: "/match", label: t.match.nav, Icon: Sparkles, wide: true },
        { href: "/messages", label: t.nav.messages, Icon: MessageSquare },
      ]
    : [
        { href: "/explore", label: t.home.landing.navBrowse, Icon: Compass },
        { href: "/professionals", label: t.nav.professionals, Icon: Users },
        { href: "/match", label: t.match.nav, Icon: Sparkles, wide: true },
        { href: "/my-tasks", label: t.nav.myTasks, Icon: ClipboardList },
        { href: "/messages", label: t.nav.messages, Icon: MessageSquare },
      ];
}
