/// Calm dotted backdrop. Whitespace is the layout — this is the only ambient
/// decoration on app surfaces, faded heavily so it never competes with content.
export function BgMesh() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="dot-fade absolute inset-0 opacity-40" />
    </div>
  );
}
