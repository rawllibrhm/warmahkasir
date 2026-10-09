export const rp = (n: number) => "Rp" + (n ?? 0).toLocaleString("id-ID");

export const STATUS_LABEL: Record<string, string> = {
  menunggu_bukti: "Menunggu Bukti Bayar",
  menunggu_pembayaran: "Bayar di Kasir",
  menunggu_validasi: "Menunggu Validasi",
  dikonfirmasi: "Dikonfirmasi",
  ditolak: "Ditolak",
};

/** Alarm berulang via WebAudio sampai stop() dipanggil. */
export function startAlarm() {
  const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
  const ctx = new AC();
  const beep = () => {
    [0, 0.25].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = i ? 1320 : 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.23);
    });
  };
  beep();
  const id = setInterval(beep, 1200);
  return () => {
    clearInterval(id);
    ctx.close();
  };
}
