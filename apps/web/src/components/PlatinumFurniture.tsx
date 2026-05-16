const desktopIcons = [
  "Mac HD",
  "Alpine API",
  "Scenarios",
  "Trash"
];

const wallpaperCells = Array.from({ length: 54 }, (_, index) => index);

const launcherItems = ["Finder", "Voice", "API", "Trace", "Tools", "Help"];

const desktopWindows = [
  {
    className: "about",
    title: "About This Computer",
    body: (
      <>
        <strong>Mac OS computer</strong>
        <p>Built-in memory: 64 MB</p>
        <p>Largest unused block: 53.5 MB</p>
        <div className="platinum-window-progress" />
      </>
    )
  },
  {
    className: "controls",
    title: "Control Panels",
    body: <div className="platinum-control-strip"><i /><i /><i /><i /></div>
  },
  {
    className: "status",
    title: "Case Folder",
    body: (
      <>
        <p>Alpine FieldOps</p>
        <p>Replay scenarios ready</p>
      </>
    )
  }
];

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
      {desktopWindows.map((window) => (
        <section className={`platinum-desktop-window ${window.className}`} key={window.title}>
          <div className="platinum-window-title">{window.title}</div>
          <div className="platinum-window-body">{window.body}</div>
        </section>
      ))}
      <div className="platinum-desktop-icons">
        {desktopIcons.map((label, index) => (
          <span key={label} className={index === desktopIcons.length - 1 ? "trash" : ""}>
            <i />
            {label}
          </span>
        ))}
      </div>
      <div className="platinum-launch-strip">
        {launcherItems.map((label) => (
          <span key={label}>
            <i />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
