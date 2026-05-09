import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { BookOpen, Users, Award } from "lucide-react";

const Home = () => {
  return (
    <Layout>
      {/* Hero Section */}
      <section
        className="relative h-[80vh] min-h-[400px] sm:min-h-[600px] flex items-center justify-center overflow-hidden"
      >
        <div 
          className="absolute inset-0 z-0 scale-110 animate-float"
          style={{
            backgroundImage: 'url("/maxresdefault.jpg")',
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "brightness(0.3) blur(2px)",
          }}
        />
        
        <div
          className="absolute inset-0 z-10"
          style={{
            background: "radial-gradient(circle at center, transparent, rgba(10,5,5,0.9))",
          }}
        />

        <div className="relative z-20 text-center px-6 max-w-5xl mx-auto flex flex-col items-center">
          <div className="mb-6 animate-reveal-down">
             <span className="text-[var(--gu-gold)] text-xs md:text-sm font-black uppercase tracking-[0.4em] mb-4 block animate-glow-pulse">
               Welcome to Ganpat University
             </span>
          </div>
          
          <h1 className="font-serif text-3xl sm:text-5xl md:text-8xl text-white mb-4 sm:mb-6 font-bold tracking-tighter animate-slide-up bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">
            Centre of Excellence
          </h1>

          <p className="font-serif italic text-[var(--gu-gold)] text-sm sm:text-xl md:text-2xl mb-8 sm:mb-12 opacity-90 animate-slide-up animate-stagger-2 max-w-2xl mx-auto leading-relaxed">
            "Empowering future leaders through technology and academic innovation"
          </p>

          <div className="flex flex-col sm:flex-row gap-6 animate-slide-up animate-stagger-3">
            <Link
              to="/login"
              className="group relative bg-[var(--gu-gold)] text-[#0A0505] font-black uppercase tracking-widest px-6 sm:px-10 py-3 sm:py-5 text-sm sm:text-base rounded-sm shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_40px_rgba(212,175,55,0.5)] transition-all duration-500 overflow-hidden"
            >
              <span className="relative z-10">Access Portal</span>
              <div className="absolute inset-0 bg-white translate-x-[-100%] group-hover:translate-x-[0%] transition-transform duration-500 skew-x-12"></div>
            </Link>
            
            <Link
              to="/academics"
              className="group px-6 sm:px-10 py-3 sm:py-5 text-sm sm:text-base border border-white/20 text-white font-black uppercase tracking-widest rounded-sm hover:bg-white/10 transition-all duration-300 backdrop-blur-md"
            >
              Explore Programs
            </Link>
          </div>
        </div>
      </section>

      {/* About Strip */}
      <section className="bg-[#150505] py-10 px-4 border-y border-[var(--gu-gold)]/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
           <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-[var(--gu-gold)] to-transparent"></div>
        </div>
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            {[
              { label: "Established", val: "2005" },
              { label: "NAAC", val: "Accredited" },
              { label: "Students", val: "10,000+" },
              { label: "Faculty", val: "500+" }
            ].map((stat, i) => (
              <div key={i} className="flex flex-col animate-fade-in" style={{ animationDelay: `${i * 150}ms` }}>
                <span className="text-[var(--gu-gold)] text-[10px] font-black uppercase tracking-widest mb-1 opacity-60">{stat.label}</span>
                <span className="text-white text-lg font-bold font-serif">{stat.val}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Info Cards */}
      <section className="py-16 sm:py-32 px-4 sm:px-6 bg-[var(--gu-cream)] relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20 animate-slide-up">
            <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--gu-red-dark)] mb-4">University Ecosystem</h2>
            <h3 className="font-serif text-4xl md:text-5xl text-[var(--gu-red-deep)] font-bold">Academic Resources</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: "Academic Programs", icon: BookOpen, desc: "Explore our diverse range of world-class undergraduate and postgraduate certifications." },
              { title: "Campus Life", icon: Users, desc: "A vibrant community of forward-thinking students, faculty, and research excellence." },
              { title: "Achievements", icon: Award, desc: "Consistently ranked as one of the premier institutes for technical education in the region." }
            ].map((card, i) => (
              <div key={i} className="group bg-white p-10 border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 animate-slide-up hover-lift" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="w-14 h-14 bg-[var(--gu-gold-light)] flex items-center justify-center rounded-full mb-8 group-hover:rotate-[360deg] transition-all duration-700">
                  <card.icon className="w-6 h-6 text-[var(--gu-red-dark)]" />
                </div>
                <h3 className="font-serif text-2xl text-[var(--gu-red-deep)] font-bold mb-4">{card.title}</h3>
                <p className="text-gray-500 leading-relaxed text-sm mb-6">{card.desc}</p>
                <div className="h-1 w-12 bg-[var(--gu-gold)] group-hover:w-full transition-all duration-500"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Home;
