import { useState } from 'react';
import Layout from '../components/Layout';
import { ChevronDown } from 'lucide-react';

const programsData = [
    {
        school: "Center of Engineering & Technology",
        programs: [
            { name: "B.Tech — Computer Engineering, IT, Mechanical, Civil, Electrical, EC", duration: "4 Years" },
            { name: "M.Tech — Computer Engineering, Mechanical", duration: "2 Years" },
            { name: "Ph.D", duration: "3-5 Years" }
        ]
    },
    {
        school: "Center of Management",
        programs: [
            { name: "BBA", duration: "3 Years" },
            { name: "MBA — Marketing, Finance, HR", duration: "2 Years" },
            { name: "Ph.D", duration: "3-5 Years" }
        ]
    },
    {
        school: "Center of Computer Applications",
        programs: [
            { name: "BCA", duration: "3 Years" },
            { name: "MCA", duration: "2 Years" }
        ]
    },
    {
        school: "Center of Pharmacy",
        programs: [
            { name: "B.Pharm", duration: "4 Years" },
            { name: "M.Pharm", duration: "2 Years" },
            { name: "Ph.D", duration: "3-5 Years" }
        ]
    },
    {
        school: "Center of Science",
        programs: [
            { name: "B.Sc — Physics, Chemistry, Maths", duration: "3 Years" },
            { name: "M.Sc", duration: "2 Years" }
        ]
    }
];

const Academics = () => {
    const [openSchool, setOpenSchool] = useState(null);

    const toggleSchool = (index) => {
        setOpenSchool(openSchool === index ? null : index);
    };

    return (
        <Layout>
            {/* Page Header */}
            <section className="bg-[var(--gu-red-dark)] py-12 sm:py-16 px-4 sm:px-6 md:px-16 lg:px-24 border-b border-[var(--gu-gold)] min-h-44 flex flex-col justify-center">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 animate-fade-in break-words">
                        Academic Programs
                    </h1>
                    <h2 className="text-[var(--gu-gold)] uppercase tracking-[0.15em] text-sm md:text-base font-medium animate-slide-up break-words" style={{ animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}>
                        Explore our Schools & Departments
                    </h2>
                </div>
            </section>

            {/* Accordion Section */}
            <section className="py-8 px-4 md:px-8 max-w-5xl mx-auto w-full flex-grow">
                <div className="flex flex-col">
                    {programsData.map((data, index) => {
                        const isOpen = openSchool === index;
                        return (
                            <div
                                key={index}
                                className="mb-4 border border-[var(--gu-red-dark)] bg-white rounded-none shadow-[4px_4px_15px_rgba(185,28,28,0.1)] overflow-hidden box-border"
                            >
                                <button
                                    onClick={() => toggleSchool(index)}
                                    className="w-full bg-[var(--gu-red)] px-6 py-4 flex justify-between items-center hover:bg-[var(--gu-red-hover)] transition-colors cursor-pointer focus:outline-none"
                                >
                                    <h3 className="font-serif text-xl font-semibold text-white text-left truncate flex-1 mr-4">
                                        {data.school}
                                    </h3>
                                    <ChevronDown
                                        className={`w-6 h-6 flex-shrink-0 text-[var(--gu-gold)] transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                <div
                                    className={`bg-[var(--gu-cream)] overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100 border-t border-[var(--gu-red-dark)]' : 'max-h-0 opacity-0'}`}
                                >
                                    <div className="flex flex-col">
                                        {data.programs.map((prog, pIndex) => {
                                            const isSubSpecialization = !prog.duration;
                                            return (
                                                <div
                                                    key={pIndex}
                                                    className={`flex items-center justify-between flex-wrap gap-2 border-b border-[rgba(185,28,28,0.2)] last:border-0 ${isSubSpecialization ? 'pl-8 border-l-4 border-l-red-700 py-2' : 'px-6 py-3'}`}
                                                >
                                                    <span className={`font-medium flex-1 mr-4 word-wrap ${isSubSpecialization ? 'text-[var(--gu-red)] text-sm' : 'text-[var(--gu-text)] text-sm'}`}>
                                                        {prog.name}
                                                    </span>
                                                    {prog.duration && (
                                                        <span className="inline-block bg-[var(--gu-gold)] text-[var(--gu-red-dark)] px-3 py-1 text-xs font-semibold rounded-none uppercase flex-shrink-0 whitespace-nowrap">
                                                            {prog.duration}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>);
                    })}
                </div>
            </section>

            {/* Info Strip */}
            <section className="bg-[var(--gu-red-dark)] py-8 px-6 border-t border-[var(--gu-gold)]">
                <div className="max-w-7xl mx-auto text-center">
                    <p className="text-white text-sm uppercase tracking-wider flex flex-wrap justify-center items-center gap-4 text-center">
                        <span className="whitespace-nowrap">All programs approved by UGC</span>
                        <span className="text-[var(--gu-gold)] w-1.5 h-1.5 rounded-full bg-[var(--gu-gold)] hidden md:inline-block"></span>
                        <span className="whitespace-nowrap">Affiliated to KSKV University</span>
                        <span className="text-[var(--gu-gold)] w-1.5 h-1.5 rounded-full bg-[var(--gu-gold)] hidden md:inline-block"></span>
                        <span className="whitespace-nowrap">AICTE Approved</span>
                    </p>
                </div>
            </section>
        </Layout>
    );
};

export default Academics;
