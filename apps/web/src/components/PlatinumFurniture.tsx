const desktopIcons = [
  "Mac HD",
  "Alpine API",
  "Scenarios",
  "Trash"
];

const wallpaperCells = Array.from({ length: 54 }, (_, index) => index);

export function PlatinumFurniture() {
  return (
    <div className="platinum-furniture" aria-hidden="true">
      <div className="platinum-menu-bar">
        <span className="platinum-apple" />
        <b>File</b>
        <b>Edit</b>
        <b>View</b>
        <b>Special</b>
        <b>Help</b>
        <time>12:39 PM</time>
      </div>
      <div className="platinum-wallpaper">
        {wallpaperCells.map((cell) => (
          <span key={cell}>Mac OS</span>
        ))}
      </div>
      <div className="platinum-desktop-icons">
        {desktopIcons.map((label, index) => (
          <span key={label} className={index === desktopIcons.length - 1 ? "trash" : ""}>
            <i />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
