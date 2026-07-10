import ChatWidget from "@/components/ChatWidget";

export const dynamic = "force-dynamic";

export default function EmbedPage() {
  // iframeで使うなら defaultOpen を true にして「最初から開いた状態」でもOK
  return (
    <div>
      <ChatWidget />
    </div>
  );
}
