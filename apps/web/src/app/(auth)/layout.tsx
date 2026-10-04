export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center p-4 sm:p-8">
      <div className="grid w-full max-w-[1040px] overflow-hidden rounded-panel bg-surface shadow-card min-[900px]:min-h-[680px] min-[900px]:grid-cols-[42fr_58fr]">
        {children}
      </div>
    </main>
  );
}
