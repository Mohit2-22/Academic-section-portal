import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Logo from '../components/Logo';
import { Eye, Target, MapPin, Shield, Award, Star, BookOpen } from 'lucide-react';

const About = () => {
    return (
        <Layout>
            {/* SECTION 1 - Hero Banner */}
            <section
                className="relative min-h-96 w-full flex flex-col items-center justify-center animate-fade-in bg-cover bg-center"
                style={{
                    backgroundImage: 'url("https://www.ganpatuniversity.ac.in/images/campus.jpg")'
                }}
            >
                <div className="absolute inset-0 w-full h-full" style={{ background: 'rgba(127,29,29,0.78)' }}></div>

                <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto pt-6">
                    <div className="mb-6"><Logo size="xl" /></div>
                    <h1 className="font-serif text-3xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
                        About Ganpat University
                    </h1>
                    <h2 className="text-[var(--gu-gold)] italic tracking-[0.1em] text-lg font-medium mb-6">
                        Building Knowledge. Shaping Futures.
                    </h2>
                    <div className="w-24 h-[1px] bg-[var(--gu-gold)]"></div>
                </div>
            </section>

            {/* SECTION 2 - Introduction */}
            <section className="bg-[var(--gu-cream)] py-16 px-6 md:px-8">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

                    <div className="flex flex-col">
                        <h3 className="text-sm text-[var(--gu-gold)] uppercase tracking-widest font-semibold mb-3">OUR STORY</h3>
                        <h2 className="font-serif text-3xl text-[var(--gu-red-dark)] font-bold mb-6">A Legacy of Academic Excellence</h2>
                        <div className="border-l-4 border-[var(--gu-gold)] pl-4 space-y-4 text-[var(--gu-text)] leading-relaxed break-words">
                            <p>
                                Ganpat University, established in 2005, is a premier private university located in Mehsana, Gujarat. Recognized by the University Grants Commission (UGC) and approved by AICTE, it stands as a beacon of quality education in western India.
                            </p>
                            <p>
                                With over 10,000 students and 500+ dedicated faculty members, the university offers a wide spectrum of programs across engineering, management, pharmacy, science, and computer applications.
                            </p>
                            <p>
                                Committed to holistic development, Ganpat University blends academic rigor with industry exposure, research opportunities, and vibrant campus life.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            { year: "2005", label: "Year Established" },
                            { year: "10,000+", label: "Students Enrolled" },
                            { year: "500+", label: "Faculty Members" },
                            { year: "50+", label: "Programs Offered" }
                        ].map((stat, idx) => (
                            <div key={idx} className="bg-[var(--gu-red)] p-6 box-border rounded-sm flex flex-col justify-center items-center text-center overflow-hidden shadow-sm">
                                <span className="font-serif text-3xl md:text-4xl font-bold text-white mb-2 truncate max-w-full">{stat.year}</span>
                                <span className="text-[var(--gu-gold)] text-sm uppercase tracking-wider font-semibold truncate max-w-full">{stat.label}</span>
                            </div>
                        ))}
                    </div>

                </div>
            </section>

            {/* SECTION 3 - Vision & Mission */}
            <section className="bg-[var(--gu-red-dark)] py-16 px-6 md:px-8 relative">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 relative">

                    {/* Vertical Divider (desktop only) */}
                    <div className="hidden md:block absolute left-1/2 top-4 bottom-4 w-px bg-[var(--gu-gold)] opacity-30 -translate-x-1/2"></div>

                    <div className="flex flex-col p-4 md:p-6">
                        <Eye className="w-8 h-8 text-[var(--gu-gold)] mb-4 stroke-1 flex-shrink-0" />
                        <h2 className="font-serif text-2xl text-white font-semibold break-words">Our Vision</h2>
                        <div className="w-12 h-0.5 bg-[var(--gu-gold)] mt-2 mb-6"></div>
                        <p className="text-white opacity-90 leading-relaxed font-sans text-lg max-w-prose break-words">
                            To be a globally recognized university that fosters innovation, research, and value-based education for the holistic development of society.
                        </p>
                    </div>

                    <div className="flex flex-col p-4 md:p-6">
                        <Target className="w-8 h-8 text-[var(--gu-gold)] mb-4 stroke-1 flex-shrink-0" />
                        <h2 className="font-serif text-2xl text-white font-semibold break-words">Our Mission</h2>
                        <div className="w-12 h-0.5 bg-[var(--gu-gold)] mt-2 mb-6"></div>
                        <p className="text-white opacity-90 leading-relaxed font-sans text-lg max-w-prose break-words">
                            To provide quality education through experienced faculty, modern infrastructure, industry collaboration, and research-driven curriculum that prepares students for global challenges.
                        </p>
                    </div>

                </div>
            </section>

            {/* SECTION 4 - Recognitions & Accreditations */}
            <section className="bg-[var(--gu-cream)] py-16 px-6 md:px-8">
                <div className="max-w-7xl mx-auto flex flex-col items-center">
                    <h2 className="font-serif text-3xl font-bold text-[var(--gu-red-dark)] mb-4 text-center">Recognitions & Accreditations</h2>
                    <div className="w-24 h-[1px] bg-[var(--gu-gold)] mb-12"></div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 w-full">
                        {[
                            { icon: Shield, title: "UGC Recognized", sub: "University Grants Commission" },
                            { icon: Award, title: "AICTE Approved", sub: "All India Council for Technical Education" },
                            { icon: Star, title: "NAAC Accredited", sub: "National Assessment & Accreditation" },
                            { icon: BookOpen, title: "NBA Accredited", sub: "National Board of Accreditation" }
                        ].map((rec, idx) => {
                            const Icon = rec.icon;
                            return (
                                <div key={idx} className="bg-white border border-[rgba(185,28,28,0.15)] border-t-[3px] border-t-[var(--gu-red)] p-6 box-border rounded-none text-center flex flex-col items-center transition-all duration-200 hover:bg-[var(--gu-red)] group overflow-hidden">
                                    <Icon className="w-8 h-8 flex-shrink-0 text-[var(--gu-red)] mb-4 group-hover:text-[var(--gu-gold)]" />
                                    <h3 className="font-serif font-semibold text-[var(--gu-red-dark)] text-base mb-1 group-hover:text-white transition-colors truncate max-w-full">{rec.title}</h3>
                                    <p className="text-[var(--gu-text)] text-sm opacity-70 group-hover:text-white transition-colors leading-relaxed break-words">{rec.sub}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* SECTION 5 - Location Strip */}
            <section className="bg-[var(--gu-red)] py-12 px-6 flex flex-col items-center text-center border-t border-[rgba(212,175,55,0.3)] shadow-[inset_0_10px_20px_rgba(0,0,0,0.1)]">
                <MapPin className="w-10 h-10 text-[var(--gu-gold)] mb-4 stroke-[1.5] flex-shrink-0" />
                <p className="font-serif text-xl md:text-2xl text-white mb-6 max-w-2xl leading-snug tracking-wide break-words">
                    Ganpat Vidyanagar, Mehsana-Gozaria Highway, Mehsana, Gujarat — 384012
                </p>
                <p className="text-[var(--gu-gold)] text-sm tracking-widest uppercase font-semibold break-words">
                    📞 +91-2762-530000 &nbsp;&nbsp;&middot;&nbsp;&nbsp; ✉ info@ganpatuniversity.ac.in
                </p>
            </section>

        </Layout>
    );
};

export default About;
