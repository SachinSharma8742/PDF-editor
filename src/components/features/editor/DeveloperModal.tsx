import React, { useCallback } from 'react';
import { X, Globe, Github, Linkedin, Heart } from 'lucide-react';
import { usePDFStore } from '../../../store/pdfStore';

interface DeveloperModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type DeveloperLink = {
    icon: React.ComponentType<{ size?: number }>;
    label: string;
    href?: string;
};

type Developer = {
    name: string;
    role: string;
    initials: string;
    gradient: string;
    links: DeveloperLink[];
};

const developers: Developer[] = [
    {
        name: 'Jayesh Saini',
        role: 'Lead Developer',
        initials: 'JS',
        gradient: 'from-blue-500 to-cyan-400',
        links: [
            { icon: Globe, label: 'Portfolio', href: 'https://jayesh-portfolio-livid.vercel.app/' },
            { icon: Github, label: 'GitHub', href: 'https://github.com/jayeshsaini524' },
            { icon: Linkedin, label: 'LinkedIn', href: 'https://www.linkedin.com/in/jayesh-saini-743554282/' },
        ],
    },
    {
        name: 'Sachin Sharma',
        role: 'Co-Developer',
        initials: 'SS',
        gradient: 'from-purple-500 to-pink-400',
        links: [
            { icon: Github, label: 'GitHub' },
            { icon: Linkedin, label: 'LinkedIn' },
        ],
    },
];

export const DeveloperModal: React.FC<DeveloperModalProps> = ({ isOpen, onClose }) => {
    const theme = usePDFStore(s => s.theme);

    const handleClose = useCallback(() => {
        onClose();
    }, [onClose]);

    if (!isOpen) return null;

    const isDark = theme === 'dark';

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
        >
            <div
                className={`relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl ${isDark ? 'bg-[#1c1c1f] text-white' : 'bg-white text-gray-900'
                    }`}
                onClick={(e) => e.stopPropagation()}
                style={{ animation: 'modalIn 0.25s ease-out' }}
            >
                <style>{`
                    @keyframes modalIn {
                        from { opacity: 0; transform: scale(0.95) translateY(8px); }
                        to { opacity: 1; transform: scale(1) translateY(0); }
                    }
                `}</style>

                {/* Header */}
                <div className={`px-5 pt-5 pb-4 flex items-center justify-between border-b ${isDark ? 'border-white/8' : 'border-gray-100'
                    }`}>
                    <div>
                        <h2 className="text-base font-bold">Developers</h2>
                        <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            The team behind this app
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-400'
                            }`}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Developer List */}
                <div className="p-4 space-y-3">
                    {developers.map((dev) => (
                        <div
                            key={dev.name}
                            className={`rounded-xl p-4 ${isDark ? 'bg-white/[0.04]' : 'bg-gray-50'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                {/* Avatar */}
                                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${dev.gradient} flex items-center justify-center shrink-0 shadow-lg`}>
                                    <span className="text-white text-xs font-black tracking-tight">
                                        {dev.initials}
                                    </span>
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-[13px] font-bold leading-none">{dev.name}</h3>
                                    <p className={`text-[11px] mt-1 font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'
                                        }`}>
                                        {dev.role}
                                    </p>
                                </div>

                                {/* Links */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {dev.links.map((link) => {
                                        const Icon = link.icon;
                                        const cls = `p-1.5 rounded-lg transition-all ${isDark
                                            ? 'text-gray-500 hover:text-white hover:bg-white/10'
                                            : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200/60'
                                            }`;

                                        return link.href ? (
                                            <a
                                                key={link.label}
                                                href={link.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={cls}
                                                title={link.label}
                                            >
                                                <Icon size={14} />
                                            </a>
                                        ) : (
                                            <button key={link.label} className={cls} title={link.label}>
                                                <Icon size={14} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className={`px-5 py-3 text-center border-t ${isDark ? 'border-white/5' : 'border-gray-100'
                    }`}>
                    <p className={`text-[10px] font-medium ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                        Made with <Heart size={10} className="inline text-red-500 mx-0.5" fill="currentColor" /> for productivity
                    </p>
                </div>
            </div>
        </div>
    );
};
