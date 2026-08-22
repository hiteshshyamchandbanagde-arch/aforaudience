import { SearchIcon } from "@/components/icons/ArtistIcons"

// Shared search-input markup for the Venues/Artists/Events directory
// pages - box chrome (border/background/padding/focus) lives on the
// .afa-search-box class in globals.css, this owns the icon+input layout.
// `className` is for page-local layout only (width/flex rules), not chrome.
interface SearchInputBoxProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
  style?: React.CSSProperties
}

export default function SearchInputBox({ value, onChange, placeholder, className, style }: SearchInputBoxProps) {
  return (
    <label className={`afa-search-box${className ? ` ${className}` : ""}`} style={style}>
      <SearchIcon style={{ width: "16px", height: "16px", color: "rgba(245,245,240,0.45)", flexShrink: 0 }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, border: "none", background: "transparent", fontSize: "14px", fontFamily: "var(--font-sans)", color: "var(--afa-text-primary)", outline: "none" }}
      />
    </label>
  )
}
