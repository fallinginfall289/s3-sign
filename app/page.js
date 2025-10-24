export default function Home() {
  const randomSeed = Math.floor(Math.random() * 10000);
  const backgroundImage = `https://picsum.photos/1920/1080?random=${randomSeed}`;

  return (
    <main className="relative w-full min-h-screen overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${backgroundImage}')` }}
        role="img"
        aria-label="Nature background"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 text-center space-y-6 sm:space-y-8 max-w-2xl mx-auto">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
          Hello, World
        </h1>
      </div>
      <footer className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/60 to-transparent py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-white/70 text-sm">
          <p>© {new Date().getFullYear()} Hello World. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">
              Nothing here
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
