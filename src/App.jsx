import './App.css'
import Whiteboard from './Whiteboard'
import sticky from './elements/sticky'

// The demo host: a full-viewport page that mounts one <Whiteboard>. This is the
// consumer's role — size the container, pass content, register custom types.
//
// `sticky` is registered here through the public `elements` prop, exactly as a
// third party would, rather than being a built-in — the extension path,
// dogfooded. DEMO_CONTENT seeds one so it shows on load; you can also draw more
// with the sticky tool (N). Both the seed and the sticky registration are safe
// to delete.
const DEMO_CONTENT = [
  {
    type: "sticky",
    uuid: "demo-sticky",
    properties: {
      startX: 160, startY: 140, endX: 380, endY: 300,
      color: "#ffe066",
      text: "I'm a custom element.\n\nRegistered through the\n<Whiteboard elements> prop —\nno engine edits.",
    },
  },
];

export default function App(){
  return (
    <div className="host">
      <Whiteboard defaultContent={DEMO_CONTENT} elements={[sticky]} />
    </div>
  )
}
