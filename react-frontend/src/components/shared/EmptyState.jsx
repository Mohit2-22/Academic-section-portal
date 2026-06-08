export default function EmptyState({ icon = '📭', title = 'Nothing here yet', message = '', action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '60px 20px', textAlign: 'center', minHeight: 300
    }}>
      <span style={{ fontSize: 56, marginBottom: 16 }}>{icon}</span>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{title}</h3>
      {message && <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 360, marginBottom: 20 }}>{message}</p>}
      {action && action}
    </div>
  );
}
