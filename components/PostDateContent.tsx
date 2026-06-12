interface PostDateContentProps {
  date: string;
  content: string | null;
}

export default function PostDateContent({ date, content }: PostDateContentProps) {
  console.log("PostDateContent rendering with:", { date, content });
  
  return (
    <div style={{
      backgroundColor: '#fef3c7',
      border: '2px solid #f59e0b',
      borderRadius: '8px',
      padding: '12px',
      margin: '8px 0'
    }}>
      <div style={{
        fontSize: '12px',
        color: '#92400e',
        fontWeight: 'bold',
        marginBottom: '4px'
      }}>
        📅 DATE: {date}
      </div>
      <div style={{
        fontSize: '14px',
        color: '#451a03'
      }}>
        📝 CONTENT: {content || "No description"}
      </div>
    </div>
  );
}