/* @ds-bundle: {"format":4,"namespace":"PMDataCareDesignSystem_ac2d54","components":[{"name":"Badge","sourcePath":"components/display/Badge.jsx"},{"name":"Tag","sourcePath":"components/display/Badge.jsx"},{"name":"Card","sourcePath":"components/display/Card.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Toast.jsx"},{"name":"Button","sourcePath":"components/forms/Button.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Radio","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Switch","sourcePath":"components/forms/Checkbox.jsx"},{"name":"IconButton","sourcePath":"components/forms/IconButton.jsx"},{"name":"Field","sourcePath":"components/forms/Input.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"AppHeader","sourcePath":"components/navigation/AppHeader.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/display/Badge.jsx":"babad2562e0c","components/display/Card.jsx":"5786982491c7","components/feedback/Dialog.jsx":"0dbc708f7f83","components/feedback/Toast.jsx":"db21c429b0a5","components/forms/Button.jsx":"1b958bf97d69","components/forms/Checkbox.jsx":"115956a93992","components/forms/IconButton.jsx":"528f2b597329","components/forms/Input.jsx":"9ca8a01e3b5c","components/forms/Select.jsx":"ad723b9ca096","components/forms/Textarea.jsx":"b471979aa819","components/navigation/AppHeader.jsx":"266df29fa6ac","components/navigation/Tabs.jsx":"006b713154d1","ui_kits/portal/Dashboard.jsx":"624999085bbc","ui_kits/portal/NewRequest.jsx":"95976d06fd62","ui_kits/portal/RequestsList.jsx":"9b5926f81e9c","ui_kits/portal/data.js":"742550a04a70"},"inlinedExternals":[],"unexposedExports":[{"name":"inputBaseStyle","sourcePath":"components/forms/Input.jsx"}]} */

(() => {

const __ds_ns = (window.PMDataCareDesignSystem_ac2d54 = window.PMDataCareDesignSystem_ac2d54 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/display/Badge.jsx
try { (() => {
const statusMap = {
  new: {
    color: "var(--status-new)",
    bg: "var(--sky-tint)",
    label: "New"
  },
  "in-progress": {
    color: "var(--status-in-progress)",
    bg: "var(--navy-tint)",
    label: "In progress"
  },
  completed: {
    color: "var(--status-completed)",
    bg: "var(--teal-tint)",
    label: "Completed"
  },
  "on-hold": {
    color: "var(--status-on-hold)",
    bg: "#EDF1F4",
    label: "On hold"
  },
  rejected: {
    color: "var(--status-rejected)",
    bg: "var(--danger-tint)",
    label: "Rejected"
  }
};
function Badge({
  status = "new",
  children,
  dot = true,
  style
}) {
  const s = statusMap[status] || statusMap.new;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "7px",
      height: "24px",
      padding: "0 11px",
      borderRadius: "var(--radius-pill)",
      fontFamily: "var(--font-ui)",
      fontSize: "12.5px",
      fontWeight: 600,
      color: s.color,
      background: s.bg,
      whiteSpace: "nowrap",
      ...style
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: s.color,
      flex: "none"
    }
  }), children || s.label);
}
function Tag({
  children,
  color = "var(--slate)",
  bg = "var(--surface-page)",
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      height: "22px",
      padding: "0 9px",
      borderRadius: "var(--radius-sm)",
      fontFamily: "var(--font-ui)",
      fontSize: "12px",
      fontWeight: 600,
      color,
      background: bg,
      border: "1px solid var(--border)",
      whiteSpace: "nowrap",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Badge, Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/display/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Card({
  title,
  action,
  padding = "var(--space-5)",
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: "var(--surface-card)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-card)",
      border: "1px solid var(--border)",
      overflow: "hidden",
      fontFamily: "var(--font-ui)",
      ...style
    }
  }, rest), (title || action) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      padding: "14px 20px",
      borderBottom: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "16px",
      fontWeight: 700,
      color: "var(--text-heading)"
    }
  }, title), action), /*#__PURE__*/React.createElement("div", {
    style: {
      padding
    }
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Card.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
const kinds = {
  success: {
    bar: "var(--success)",
    icon: "✓"
  },
  info: {
    bar: "var(--info)",
    icon: "i"
  },
  warning: {
    bar: "var(--warning)",
    icon: "!"
  },
  danger: {
    bar: "var(--danger)",
    icon: "!"
  }
};
function Toast({
  kind = "success",
  title,
  children,
  onClose,
  style
}) {
  const k = kinds[kind] || kinds.success;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "12px",
      alignItems: "flex-start",
      width: 360,
      padding: "14px 16px",
      background: "#fff",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-raised)",
      border: "1px solid var(--border)",
      fontFamily: "var(--font-ui)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      height: 22,
      borderRadius: "50%",
      background: k.bar,
      color: "#fff",
      fontSize: 13,
      fontWeight: 800,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "none"
    }
  }, k.icon), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: "var(--text-heading)"
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--text-muted)"
    }
  }, children)), onClose && /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Dismiss",
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "var(--text-muted)",
      fontSize: 14,
      padding: 0,
      lineHeight: 1
    }
  }, "\u2715"));
}
function Tooltip({
  label,
  children
}) {
  const [show, setShow] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-flex"
    },
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false)
  }, children, show && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      bottom: "calc(100% + 8px)",
      left: "50%",
      transform: "translateX(-50%)",
      background: "var(--navy)",
      color: "#fff",
      fontSize: 12,
      fontWeight: 600,
      fontFamily: "var(--font-ui)",
      padding: "6px 10px",
      borderRadius: "var(--radius-sm)",
      whiteSpace: "nowrap",
      zIndex: 50,
      boxShadow: "var(--shadow-raised)"
    }
  }, label));
}
Object.assign(__ds_scope, { Toast, Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const sizes = {
  sm: {
    height: "var(--control-h-sm)",
    padding: "0 14px",
    fontSize: "13px"
  },
  md: {
    height: "var(--control-h-md)",
    padding: "0 18px",
    fontSize: "14px"
  },
  lg: {
    height: "var(--control-h-lg)",
    padding: "0 24px",
    fontSize: "16px"
  }
};
const variants = {
  primary: {
    background: "var(--accent)",
    color: "#fff",
    border: "1px solid transparent",
    hoverBg: "var(--accent-hover)"
  },
  secondary: {
    background: "#fff",
    color: "var(--accent)",
    border: "1px solid var(--border-input)",
    hoverBg: "var(--surface-tint)"
  },
  ghost: {
    background: "transparent",
    color: "var(--accent)",
    border: "1px solid transparent",
    hoverBg: "var(--surface-tint)"
  },
  danger: {
    background: "var(--danger)",
    color: "#fff",
    border: "1px solid transparent",
    hoverBg: "#BC3A4D"
  },
  success: {
    background: "var(--success)",
    color: "#fff",
    border: "1px solid transparent",
    hoverBg: "var(--teal-hover)"
  }
};
function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  icon = null,
  children,
  style,
  ...rest
}) {
  const v = variants[variant] || variants.primary,
    s = sizes[size] || sizes.md;
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      fontFamily: "var(--font-ui)",
      fontWeight: 600,
      borderRadius: "var(--radius-sm)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      transition: "background var(--dur-fast) var(--ease)",
      whiteSpace: "nowrap",
      background: hover && !disabled ? v.hoverBg : v.background,
      color: v.color,
      border: v.border,
      ...s,
      ...style
    }
  }, rest), icon, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function Dialog({
  open,
  title,
  children,
  onClose,
  footer,
  width = 480
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(13,59,102,.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 100,
      fontFamily: "var(--font-ui)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    role: "dialog",
    style: {
      width,
      maxWidth: "92vw",
      background: "#fff",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-overlay)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "18px 24px",
      borderBottom: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: "var(--text-heading)"
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      fontSize: 18,
      color: "var(--text-muted)",
      padding: 4,
      lineHeight: 1
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 24px",
      fontSize: 14,
      color: "var(--text-body)"
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "10px",
      padding: "16px 24px",
      background: "var(--surface-page)",
      borderTop: "1px solid var(--border)"
    }
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Checkbox({
  label,
  checked,
  onChange,
  disabled,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      fontFamily: "var(--font-ui)",
      fontSize: "14px",
      color: disabled ? "var(--text-muted)" : "var(--text-body)",
      cursor: disabled ? "not-allowed" : "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      width: 18,
      height: 18,
      flex: "none"
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    checked: checked,
    onChange: onChange,
    disabled: disabled,
    style: {
      position: "absolute",
      inset: 0,
      opacity: 0,
      cursor: "inherit"
    }
  }, rest)), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      inset: 0,
      borderRadius: 4,
      border: `1.5px solid ${checked ? "var(--accent)" : "var(--border-input)"}`,
      background: checked ? "var(--accent)" : "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all var(--dur-fast) var(--ease)"
    }
  }, checked && /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 12 12",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 6.5L4.8 9L10 3.5",
    stroke: "#fff",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })))), label);
}
function Radio({
  label,
  checked,
  onChange,
  disabled,
  name,
  value,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      fontFamily: "var(--font-ui)",
      fontSize: "14px",
      color: disabled ? "var(--text-muted)" : "var(--text-body)",
      cursor: disabled ? "not-allowed" : "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      width: 18,
      height: 18,
      flex: "none"
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "radio",
    name: name,
    value: value,
    checked: checked,
    onChange: onChange,
    disabled: disabled,
    style: {
      position: "absolute",
      inset: 0,
      opacity: 0,
      cursor: "inherit"
    }
  }, rest)), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      border: `1.5px solid ${checked ? "var(--accent)" : "var(--border-input)"}`,
      background: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all var(--dur-fast) var(--ease)"
    }
  }, checked && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: "50%",
      background: "var(--accent)"
    }
  }))), label);
}
function Switch({
  label,
  checked,
  onChange,
  disabled,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "10px",
      fontFamily: "var(--font-ui)",
      fontSize: "14px",
      color: disabled ? "var(--text-muted)" : "var(--text-body)",
      cursor: disabled ? "not-allowed" : "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      width: 38,
      height: 22,
      flex: "none"
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    role: "switch",
    checked: checked,
    onChange: onChange,
    disabled: disabled,
    style: {
      position: "absolute",
      inset: 0,
      opacity: 0,
      cursor: "inherit"
    }
  }, rest)), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      inset: 0,
      borderRadius: "var(--radius-pill)",
      background: checked ? "var(--teal)" : "var(--border-strong)",
      transition: "background var(--dur-med) var(--ease)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 2,
      left: checked ? 18 : 2,
      width: 18,
      height: 18,
      borderRadius: "50%",
      background: "#fff",
      boxShadow: "0 1px 3px rgba(13,59,102,.3)",
      transition: "left var(--dur-med) var(--ease)"
    }
  })), label);
}
Object.assign(__ds_scope, { Checkbox, Radio, Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function IconButton({
  label,
  size = "md",
  variant = "ghost",
  disabled = false,
  children,
  style,
  ...rest
}) {
  const d = size === "sm" ? 32 : size === "lg" ? 48 : 40;
  const [hover, setHover] = React.useState(false);
  const styles = {
    ghost: {
      background: hover ? "var(--surface-tint)" : "transparent",
      color: "var(--text-muted)",
      border: "1px solid transparent"
    },
    outline: {
      background: hover ? "var(--surface-tint)" : "#fff",
      color: "var(--accent)",
      border: "1px solid var(--border-input)"
    },
    primary: {
      background: hover ? "var(--accent-hover)" : "var(--accent)",
      color: "#fff",
      border: "1px solid transparent"
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    "aria-label": label,
    title: label,
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      width: d,
      height: d,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-sm)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      transition: "background var(--dur-fast) var(--ease)",
      ...styles[variant],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Field({
  label,
  required,
  hint,
  error,
  children
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      fontFamily: "var(--font-ui)"
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "13px",
      fontWeight: 600,
      color: "var(--text-heading)"
    }
  }, label, required && /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--danger)"
    }
  }, " *")), children, error ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "12px",
      color: "var(--danger)"
    }
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "12px",
      color: "var(--text-muted)"
    }
  }, hint) : null);
}
function inputBaseStyle(focus, error, disabled) {
  return {
    height: "var(--control-h-md)",
    padding: "0 12px",
    fontFamily: "var(--font-ui)",
    fontSize: "14px",
    color: "var(--text-body)",
    background: disabled ? "var(--surface-page)" : "#fff",
    borderRadius: "var(--radius-sm)",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    border: `1px solid ${error ? "var(--danger)" : focus ? "var(--focus-ring)" : "var(--border-input)"}`,
    boxShadow: focus ? "var(--shadow-focus)" : "none",
    transition: "box-shadow var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)"
  };
}
function Input({
  label,
  required,
  hint,
  error,
  disabled,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement(Field, {
    label: label,
    required: required,
    hint: hint,
    error: error
  }, /*#__PURE__*/React.createElement("input", _extends({
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      ...inputBaseStyle(focus, error, disabled),
      ...style
    }
  }, rest)));
}
Object.assign(__ds_scope, { Field, inputBaseStyle, Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Select({
  label,
  required,
  hint,
  error,
  disabled,
  options = [],
  placeholder,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement(__ds_scope.Field, {
    label: label,
    required: required,
    hint: hint,
    error: error
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      ...__ds_scope.inputBaseStyle(focus, error, disabled),
      appearance: "none",
      paddingRight: "32px",
      cursor: "pointer",
      ...style
    }
  }, rest), placeholder && /*#__PURE__*/React.createElement("option", {
    value: ""
  }, placeholder), options.map(o => typeof o === "string" ? /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o) : /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      right: "12px",
      top: "50%",
      transform: "translateY(-50%)",
      pointerEvents: "none",
      color: "var(--text-muted)",
      fontSize: "11px"
    }
  }, "\u25BE")));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Textarea({
  label,
  required,
  hint,
  error,
  disabled,
  rows = 4,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement(__ds_scope.Field, {
    label: label,
    required: required,
    hint: hint,
    error: error
  }, /*#__PURE__*/React.createElement("textarea", _extends({
    disabled: disabled,
    rows: rows,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      padding: "10px 12px",
      fontFamily: "var(--font-ui)",
      fontSize: "14px",
      color: "var(--text-body)",
      lineHeight: 1.5,
      background: disabled ? "var(--surface-page)" : "#fff",
      borderRadius: "var(--radius-sm)",
      outline: "none",
      width: "100%",
      boxSizing: "border-box",
      resize: "vertical",
      border: `1px solid ${error ? "var(--danger)" : focus ? "var(--focus-ring)" : "var(--border-input)"}`,
      boxShadow: focus ? "var(--shadow-focus)" : "none",
      transition: "box-shadow var(--dur-fast) var(--ease)",
      ...style
    }
  }, rest)));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/navigation/AppHeader.jsx
try { (() => {
function AppHeader({
  active = "Home",
  onNavigate,
  items = ["Home", "Requests", "Changes", "Reports", "Dashboards"],
  notifications = 0,
  user = "ME",
  logoSrc,
  style
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-6)",
      height: 64,
      padding: "0 var(--space-6)",
      background: "var(--surface-header)",
      borderBottom: "1px solid var(--border)",
      fontFamily: "var(--font-ui)",
      boxSizing: "border-box",
      ...style
    }
  }, logoSrc ? /*#__PURE__*/React.createElement("img", {
    src: logoSrc,
    alt: "PM DataCare",
    style: {
      height: 34
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 19,
      color: "var(--navy)",
      whiteSpace: "nowrap"
    }
  }, "PM ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--blue)"
    }
  }, "Data"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--teal)"
    }
  }, "Care")), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      gap: "4px",
      flex: 1
    }
  }, items.map(it => {
    const is = it === active;
    return /*#__PURE__*/React.createElement("button", {
      key: it,
      onClick: () => onNavigate && onNavigate(it),
      style: {
        padding: "8px 14px",
        fontSize: 14,
        fontFamily: "var(--font-ui)",
        fontWeight: 600,
        background: "none",
        border: "none",
        cursor: "pointer",
        color: is ? "var(--accent)" : "var(--text-muted)",
        borderBottom: is ? "2.5px solid var(--accent)" : "2.5px solid transparent",
        height: 64,
        boxSizing: "border-box"
      }
    }, it);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--text-muted)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10.3 21a1.94 1.94 0 0 0 3.4 0"
  })), notifications > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: -6,
      right: -8,
      minWidth: 16,
      height: 16,
      borderRadius: "var(--radius-pill)",
      background: "var(--blue)",
      color: "#fff",
      fontSize: 10.5,
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 4px"
    }
  }, notifications)), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: "50%",
      background: "var(--surface-tint)",
      color: "var(--navy)",
      fontSize: 13,
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, user));
}
Object.assign(__ds_scope, { AppHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/AppHeader.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  tabs = [],
  active,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "4px",
      borderBottom: "1px solid var(--border)",
      fontFamily: "var(--font-ui)",
      ...style
    }
  }, tabs.map(t => {
    const label = typeof t === "string" ? t : t.label,
      id = typeof t === "string" ? t : t.id,
      count = typeof t === "object" ? t.count : undefined,
      is = id === active;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      onClick: () => onChange && onChange(id),
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        padding: "10px 14px",
        fontSize: "14px",
        fontFamily: "var(--font-ui)",
        fontWeight: 600,
        cursor: "pointer",
        background: "none",
        border: "none",
        borderBottom: is ? "2.5px solid var(--accent)" : "2.5px solid transparent",
        marginBottom: "-1px",
        color: is ? "var(--accent)" : "var(--text-muted)",
        transition: "color var(--dur-fast) var(--ease)"
      }
    }, label, count !== undefined && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: "11.5px",
        fontWeight: 700,
        padding: "1px 7px",
        borderRadius: "var(--radius-pill)",
        background: is ? "var(--surface-tint)" : "var(--surface-page)",
        color: is ? "var(--accent)" : "var(--text-muted)"
      }
    }, count));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal/Dashboard.jsx
try { (() => {
const {
  Card,
  Badge,
  Tag,
  Button,
  Tabs,
  Input,
  Select
} = window.PMDataCareDesignSystem_ac2d54;
const D = window.PORTAL_DATA;
function StatCard({
  label,
  value,
  accent
}) {
  return /*#__PURE__*/React.createElement(Card, {
    padding: "16px 20px",
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "var(--text-muted)"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 30,
      fontWeight: 800,
      color: accent || "var(--text-heading)",
      fontVariantNumeric: "tabular-nums",
      marginTop: 4
    }
  }, value));
}
function RequestRow({
  r,
  onOpen
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: () => onOpen(r),
    style: {
      display: "grid",
      gridTemplateColumns: "90px 1fr 150px 130px 120px",
      gap: 12,
      alignItems: "center",
      padding: "13px 20px",
      borderTop: "1px solid var(--border)",
      cursor: "pointer",
      background: "#fff"
    },
    onMouseEnter: e => e.currentTarget.style.background = "var(--surface-tint)",
    onMouseLeave: e => e.currentTarget.style.background = "#fff"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: "var(--blue)",
      fontVariantNumeric: "tabular-nums"
    }
  }, r.id), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: "var(--text-heading)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, r.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--text-muted)"
    }
  }, r.type, " \xB7 ", r.plant, " \xB7 ", r.age)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: "var(--text-body)"
    }
  }, r.requester), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: r.assignee === "—" ? "var(--text-muted)" : "var(--text-body)"
    }
  }, r.assignee), /*#__PURE__*/React.createElement(Badge, {
    status: r.status
  }));
}
function Dashboard({
  go,
  openRequest
}) {
  const open = D.requests.filter(r => ["new", "in-progress"].includes(r.status));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 26,
      fontWeight: 800,
      color: "var(--text-heading)"
    }
  }, "Good morning, Alex"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "4px 0 0",
      fontSize: 14,
      color: "var(--text-muted)"
    }
  }, "Here's what's happening with your SAP PM master data requests.")), /*#__PURE__*/React.createElement(Button, {
    onClick: () => go("New request"),
    icon: /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16,
        fontWeight: 700,
        lineHeight: 1
      }
    }, "+")
  }, "New request")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Open requests",
    value: "12",
    accent: "var(--blue)"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "In progress",
    value: "7"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Completed this month",
    value: "38",
    accent: "var(--teal)"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Avg. turnaround",
    value: "1.8d",
    accent: "var(--sky)"
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Needs your attention",
    padding: "0",
    action: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost",
      onClick: () => go("Requests")
    }, "View all requests")
  }, open.map(r => /*#__PURE__*/React.createElement(RequestRow, {
    key: r.id,
    r: r,
    onOpen: openRequest
  }))));
}
Object.assign(window, {
  Dashboard,
  RequestRow,
  StatCard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal/NewRequest.jsx
try { (() => {
const {
  Card,
  Badge,
  Tag,
  Button,
  Input,
  Select,
  Textarea,
  Checkbox,
  Toast,
  Dialog
} = window.PMDataCareDesignSystem_ac2d54;
const D = window.PORTAL_DATA;
function NewRequest({
  go
}) {
  const [confirm, setConfirm] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 720,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 26,
      fontWeight: 800,
      color: "var(--text-heading)"
    }
  }, "New change request"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "4px 0 0",
      fontSize: 14,
      color: "var(--text-muted)"
    }
  }, "Tell us what needs to change \u2014 a data maintainer will carry it into SAP PM.")), /*#__PURE__*/React.createElement(Card, {
    padding: "24px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Select, {
    label: "Change type",
    required: true,
    placeholder: "Select\u2026",
    options: D.changeTypes
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Plant",
    required: true,
    placeholder: "Select\u2026",
    options: D.plants
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Equipment / functional location",
    placeholder: "e.g. 10004312 or K1-DOS-02",
    hint: "Leave empty when creating a new object"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Cost center",
    placeholder: "e.g. CC-4711"
  })), /*#__PURE__*/React.createElement(Textarea, {
    label: "Describe the change",
    required: true,
    rows: 4,
    placeholder: "What should be changed, and why? Include exact values where possible."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Select, {
    label: "Priority",
    options: ["Low", "Medium", "High"],
    hint: "High = production impact"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Reference (optional)",
    placeholder: "Notification or work order number"
  })), /*#__PURE__*/React.createElement(Checkbox, {
    label: "Notify me by email when the change is completed",
    checked: true,
    onChange: () => {}
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => go("Home")
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: () => setConfirm(true)
  }, "Submit request")), /*#__PURE__*/React.createElement(Dialog, {
    open: confirm,
    title: "Submit request?",
    onClose: () => setConfirm(false),
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      onClick: () => setConfirm(false)
    }, "Keep editing"), /*#__PURE__*/React.createElement(Button, {
      onClick: () => {
        setConfirm(false);
        setSent(true);
        setTimeout(() => go("Home"), 1600);
      }
    }, "Submit"))
  }, "Your request will be assigned to a data maintainer. You can track its status under Requests."), sent && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      bottom: 24,
      right: 24,
      zIndex: 200
    }
  }, /*#__PURE__*/React.createElement(Toast, {
    kind: "success",
    title: "Request submitted"
  }, "CR-1044 was sent to the data maintenance team.")));
}
function RequestDetail({
  r,
  back
}) {
  if (!r) return null;
  const dots = {
    done: "var(--teal)",
    active: "var(--blue)",
    todo: "var(--border-strong)"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      back();
    },
    style: {
      fontSize: 13,
      fontWeight: 600
    }
  }, "\u2190 Back to requests"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 24,
      fontWeight: 800,
      color: "var(--text-heading)"
    }
  }, r.id, " \xB7 ", r.title), /*#__PURE__*/React.createElement(Badge, {
    status: r.status
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 8,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Tag, null, r.type), /*#__PURE__*/React.createElement(Tag, null, r.plant), /*#__PURE__*/React.createElement(Tag, null, "Priority: ", r.priority))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 340px",
      gap: 16,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Request details"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 16px",
      fontSize: 14,
      lineHeight: 1.6,
      color: "var(--text-body)"
    }
  }, r.desc), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "12px 24px",
      fontSize: 13.5
    }
  }, [["Object", r.object], ["Cost center", r.costCenter], ["Requested by", r.requester], ["Assigned maintainer", r.assignee]].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "var(--text-muted)",
      marginBottom: 2
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      color: "var(--text-heading)",
      fontWeight: 600
    }
  }, v))))), /*#__PURE__*/React.createElement(Card, {
    title: "Status"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column"
    }
  }, D.timeline.map(([t, sub, state], i) => /*#__PURE__*/React.createElement("div", {
    key: t,
    style: {
      display: "flex",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: "50%",
      background: dots[state],
      flex: "none",
      marginTop: 3,
      boxShadow: state === "active" ? "var(--shadow-focus)" : "none"
    }
  }), i < D.timeline.length - 1 && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 2,
      flex: 1,
      background: "var(--border)",
      minHeight: 26
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: i < D.timeline.length - 1 ? 14 : 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 600,
      color: state === "todo" ? "var(--text-muted)" : "var(--text-heading)"
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--text-muted)"
    }
  }, sub))))))));
}
Object.assign(window, {
  NewRequest,
  RequestDetail
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal/NewRequest.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal/RequestsList.jsx
try { (() => {
const {
  Card,
  Badge,
  Tag,
  Button,
  Tabs,
  Input,
  Select
} = window.PMDataCareDesignSystem_ac2d54;
const D = window.PORTAL_DATA;
function RequestsList({
  go,
  openRequest
}) {
  const [tab, setTab] = React.useState("all");
  const [q, setQ] = React.useState("");
  const inTab = r => tab === "all" ? true : tab === "open" ? ["new", "in-progress", "on-hold"].includes(r.status) : r.status === "completed";
  const rows = D.requests.filter(r => inTab(r) && (q === "" || (r.id + r.title + r.requester).toLowerCase().includes(q.toLowerCase())));
  const count = f => D.requests.filter(f).length;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 26,
      fontWeight: 800,
      color: "var(--text-heading)"
    }
  }, "Requests"), /*#__PURE__*/React.createElement(Button, {
    onClick: () => go("New request"),
    icon: /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16,
        fontWeight: 700,
        lineHeight: 1
      }
    }, "+")
  }, "New request")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    tabs: [{
      id: "all",
      label: "All",
      count: D.requests.length
    }, {
      id: "open",
      label: "Open",
      count: count(r => ["new", "in-progress", "on-hold"].includes(r.status))
    }, {
      id: "done",
      label: "Completed",
      count: count(r => r.status === "completed")
    }],
    active: tab,
    onChange: setTab,
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 260
    }
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Search id, title, requester\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  }))), /*#__PURE__*/React.createElement(Card, {
    padding: "0"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "90px 1fr 150px 130px 120px",
      gap: 12,
      padding: "10px 20px",
      fontSize: 11.5,
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "var(--text-muted)"
    }
  }, /*#__PURE__*/React.createElement("span", null, "ID"), /*#__PURE__*/React.createElement("span", null, "Request"), /*#__PURE__*/React.createElement("span", null, "Requester"), /*#__PURE__*/React.createElement("span", null, "Maintainer"), /*#__PURE__*/React.createElement("span", null, "Status")), rows.map(r => /*#__PURE__*/React.createElement(RequestRow, {
    key: r.id,
    r: r,
    onOpen: openRequest
  })), rows.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "32px 20px",
      textAlign: "center",
      fontSize: 14,
      color: "var(--text-muted)",
      borderTop: "1px solid var(--border)"
    }
  }, "No requests match your search.")));
}
Object.assign(window, {
  RequestsList
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal/RequestsList.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal/data.js
try { (() => {
window.PORTAL_DATA = {
  requests: [{
    id: "CR-1043",
    title: "Create equipment — new dosing pump P-204B",
    type: "Create equipment",
    plant: "Plant 1000",
    status: "new",
    requester: "J. Alvarez",
    assignee: "—",
    age: "2h ago",
    priority: "High",
    desc: "New dosing pump installed in line 2 during the June shutdown. Needs an equipment master record with manufacturer data and assignment to functional location K1-DOS-02.",
    object: "P-204B (new)",
    costCenter: "CC-4711"
  }, {
    id: "CR-1042",
    title: "Update equipment description for 10004312",
    type: "Update equipment",
    plant: "Plant 1000",
    status: "in-progress",
    requester: "M. Chen",
    assignee: "S. Okafor",
    age: "2d ago",
    priority: "Medium",
    desc: "Description still references the old motor model. Should read 'Agitator motor 15kW ABB M3BP'.",
    object: "10004312",
    costCenter: "CC-4711"
  }, {
    id: "CR-1041",
    title: "New functional location for packaging line 4",
    type: "Create functional location",
    plant: "Plant 2000",
    status: "in-progress",
    requester: "A. Petrov",
    assignee: "S. Okafor",
    age: "3d ago",
    priority: "High",
    desc: "Packaging line 4 commissioned last week; needs FL hierarchy K2-PAK-04 with three sub-levels.",
    object: "K2-PAK-04 (new)",
    costCenter: "CC-5220"
  }, {
    id: "CR-1039",
    title: "Correct cost center on pump station equipment",
    type: "Update equipment",
    plant: "Plant 1000",
    status: "on-hold",
    requester: "L. Fischer",
    assignee: "D. Rahman",
    age: "5d ago",
    priority: "Low",
    desc: "Waiting for controlling to confirm the new cost center split.",
    object: "10003877",
    costCenter: "TBD"
  }, {
    id: "CR-1038",
    title: "Update task list for quarterly compressor PM",
    type: "Update task list",
    plant: "Plant 2000",
    status: "completed",
    requester: "J. Alvarez",
    assignee: "S. Okafor",
    age: "6d ago",
    priority: "Medium",
    desc: "Added torque check operation 0040 per updated OEM manual.",
    object: "TL-CMP-Q01",
    costCenter: "CC-5220"
  }, {
    id: "CR-1036",
    title: "Deactivate retired conveyor equipment",
    type: "Update equipment",
    plant: "Plant 1000",
    status: "rejected",
    requester: "M. Chen",
    assignee: "D. Rahman",
    age: "8d ago",
    priority: "Low",
    desc: "Rejected: equipment still has open notifications. Close M2 notifications first, then resubmit.",
    object: "10002145",
    costCenter: "CC-4711"
  }],
  changeTypes: ["Create equipment", "Update equipment", "Create functional location", "Update functional location", "Create/Update task list", "Update maintenance plan", "Other master data change"],
  plants: ["Plant 1000 — Hamburg", "Plant 2000 — Rotterdam", "Plant 3000 — Lyon"],
  timeline: [["Submitted", "M. Chen · Jul 16, 09:12", "done"], ["Assigned to S. Okafor", "Data maintenance team · Jul 16, 10:05", "done"], ["Change in progress", "S. Okafor · Jul 17, 14:30", "active"], ["Carried into SAP PM", "Pending", "todo"]]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Field = __ds_scope.Field;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.AppHeader = __ds_scope.AppHeader;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
