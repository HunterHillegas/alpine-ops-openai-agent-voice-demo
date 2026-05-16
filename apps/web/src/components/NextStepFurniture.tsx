const menuItems = ["Info >", "File >", "Edit >", "View >", "Tools >", "Windows >", "Services >", "Hide h", "Log Out q"];

export function NextStepFurniture() {
  return (
    <>
      <div className="nextstep-menu" aria-hidden="true">
        <b>Workspace</b>
        {menuItems.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="nextstep-dock" aria-hidden="true">
        <b>NeXT</b>
        <span>7:47<br />SUN<br />5</span>
        <span>MAIL</span>
        <span>BOOK</span>
        <span>DOC</span>
      </div>
    </>
  );
}
