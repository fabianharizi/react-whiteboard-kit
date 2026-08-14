import styles from "./Shape.module.css"

// A rectangle or an oval — `type` picks the class. The component is dumb: it
// draws style from `properties` and takes its POSITION from `frame`, the
// engine-computed bag (--x/--y/--width/--height/--rotation, data-uuid,
// data-selected) that boxFrame produces. Spreading it is the whole positioning +
// hit-testing contract; merging `...frame.style` keeps those vars while adding
// this element's own. The Preview ghost renders through the same component and
// passes a uuid-less frame, so the box math lives in boxFrame, not here.
//
// Properties
//    fill: css(color)
//    strokeColor: css(color)
//    strokeWidth: int
//    strokeStyle: solid | dashed | dotted
//    borderRadius: int
//    opacity: int

export default function Shape({ type, properties, frame }){

  const p = {
    fill: "#ffffff",
    strokeColor: "#ffffff",
    strokeWidth: 2,
    strokeStyle: "solid",
    borderRadius: 0,
    opacity: 1,
    ...properties
  }

  return(
    <div
      className={styles.shape + " " + (
        (type === "rectangle") ? styles.rectangle :
        (type === "oval") ? styles.oval : ""
      )}
      {...frame}
      style={{
        ...frame.style,
        "--fill": p.fill,
        "--strokeColor": p.strokeColor,
        "--strokeWidth": p.strokeWidth + "px",
        "--strokeStyle": p.strokeStyle,
        "--borderRadius": p.borderRadius + "px",
        "--opacity": p.opacity,
      }}
    ></div>
  )
}
