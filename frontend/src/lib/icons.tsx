"use client";

/**
 * Centralized Font Awesome icon wrappers.
 *
 * Each export matches the old lucide-react component name so swapping the
 * import path in consumer files is the only change needed.
 *
 * Style preference: regular (outlined / slim) where available in the free
 * tier, solid elsewhere.  If the project upgrades to FA Pro, swap the solid
 * imports below for `@fortawesome/pro-light-svg-icons` (thin) or
 * `@fortawesome/pro-regular-svg-icons` (outlined) for a fully-slim set.
 */

import React from "react";
import {
  FontAwesomeIcon,
  FontAwesomeIconProps,
} from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

// ── Regular (outlined) imports ──────────────────────────────────────────────
import {
  faBell as farBell,
  faBuilding as farBuilding,
  faCalendar as farCalendar,
  faCircleCheck as farCircleCheck,
  faClock as farClock,
  faEye as farEye,
  faEyeSlash as farEyeSlash,
  faFileExcel as farFileExcel,
  faFileLines as farFileLines,
  faFloppyDisk as farFloppyDisk,
  faPaperPlane as farPaperPlane,
  faPenToSquare as farPenToSquare,
  faRectangleList as farRectangleList,
  faTrashCan as farTrashCan,
  faUser as farUser,
} from "@fortawesome/free-regular-svg-icons";

// ── Solid imports (no free regular variant) ─────────────────────────────────
import {
  faArrowsUpDown,
  faArrowUpRightFromSquare,
  faBars,
  faCamera,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
  faCircleInfo,
  faCloudArrowUp,
  faDownload,
  faEllipsisVertical,
  faFilter,
  faGear,
  faHouse,
  faList,
  faMagnifyingGlass,
  faPaperclip,
  faPlus,
  faRightFromBracket,
  faRobot,
  faRotate,
  faShieldHalved,
  faShield,
  faSliders,
  faSort,
  faSpinner,
  faTableCellsLarge,
  faTag,
  faTriangleExclamation,
  faUpload,
  faUsers,
  faXmark,
  faPrint,
} from "@fortawesome/free-solid-svg-icons";

// ── Wrapper factory ─────────────────────────────────────────────────────────

interface IconProps extends Omit<FontAwesomeIconProps, "icon" | "size"> {
  size?: number;
  className?: string;
}

function makeIcon(def: IconDefinition, displayName: string) {
  const Comp = ({ size, className, style, ...rest }: IconProps) => (
    <FontAwesomeIcon
      icon={def}
      className={className}
      style={size ? { width: size, height: size, ...style } : style}
      {...rest}
    />
  );
  Comp.displayName = displayName;
  return Comp;
}

// ── Exported icon components (same names as lucide-react) ───────────────────

// Navigation / chrome
export const ChevronDown = makeIcon(faChevronDown, "ChevronDown");
export const ChevronRight = makeIcon(faChevronRight, "ChevronRight");
export const ChevronLeft = makeIcon(faChevronLeft, "ChevronLeft");
export const ChevronUp = makeIcon(faChevronUp, "ChevronUp");
export const ChevronsUpDown = makeIcon(faSort, "ChevronsUpDown");
export const Menu = makeIcon(faBars, "Menu");
export const Home = makeIcon(faHouse, "Home");
export const X = makeIcon(faXmark, "X");

// Actions
export const Search = makeIcon(faMagnifyingGlass, "Search");
export const Plus = makeIcon(faPlus, "Plus");
export const Check = makeIcon(faCheck, "Check");
export const Pencil = makeIcon(farPenToSquare, "Pencil");
export const Trash2 = makeIcon(farTrashCan, "Trash2");
export const Upload = makeIcon(faUpload, "Upload");
export const Download = makeIcon(faDownload, "Download");
export const RefreshCw = makeIcon(faRotate, "RefreshCw");
export const Save = makeIcon(farFloppyDisk, "Save");
export const Send = makeIcon(farPaperPlane, "Send");
export const Filter = makeIcon(faFilter, "Filter");
export const Printer = makeIcon(faPrint, "Printer");
export const ExternalLink = makeIcon(
  faArrowUpRightFromSquare,
  "ExternalLink"
);

// Layout
export const LayoutGrid = makeIcon(faTableCellsLarge, "LayoutGrid");
export const LayoutList = makeIcon(farRectangleList, "LayoutList");
export const List = makeIcon(faList, "List");
export const SlidersHorizontal = makeIcon(faSliders, "SlidersHorizontal");
export const ArrowUpDown = makeIcon(faArrowsUpDown, "ArrowUpDown");
export const MoreVertical = makeIcon(faEllipsisVertical, "MoreVertical");

// Objects / entities
export const Building2 = makeIcon(farBuilding, "Building2");
export const Users = makeIcon(faUsers, "Users");
export const User = makeIcon(farUser, "User");
export const Tag = makeIcon(faTag, "Tag");
export const Calendar = makeIcon(farCalendar, "Calendar");
export const Clock = makeIcon(farClock, "Clock");
export const FileSpreadsheet = makeIcon(farFileExcel, "FileSpreadsheet");
export const FileText = makeIcon(farFileLines, "FileText");

// Status / alerts
export const AlertTriangle = makeIcon(
  faTriangleExclamation,
  "AlertTriangle"
);
export const Bell = makeIcon(farBell, "Bell");
export const Info = makeIcon(faCircleInfo, "Info");
export const CheckCircle2 = makeIcon(farCircleCheck, "CheckCircle2");
export const Shield = makeIcon(faShield, "Shield");
export const ShieldAlert = makeIcon(faShieldHalved, "ShieldAlert");
export const ShieldCheck = makeIcon(faShieldHalved, "ShieldCheck");

// AI / misc
export const Bot = makeIcon(faRobot, "Bot");
export const Loader2 = makeIcon(faSpinner, "Loader2");
export const Paperclip = makeIcon(faPaperclip, "Paperclip");
export const Camera = makeIcon(faCamera, "Camera");

// Auth
export const Eye = makeIcon(farEye, "Eye");
export const EyeOff = makeIcon(farEyeSlash, "EyeOff");
export const Settings = makeIcon(faGear, "Settings");
export const LogOut = makeIcon(faRightFromBracket, "LogOut");

// Upload (cloud variant used in some views)
export const CloudUpload = makeIcon(faCloudArrowUp, "CloudUpload");
