import { useState, useEffect } from "react";

interface ProfileSettingsNavProps {
  isStacked: boolean;
  onToggleExpansion: () => void;
  canToggle: boolean;
}

interface SettingsSection {
  id: string;
  name: string;
  icon: React.ReactNode;
  isDangerous?: boolean;
}

export default function ProfileSettingsNav({ 
  isStacked, 
  onToggleExpansion, 
  canToggle 
}: ProfileSettingsNavProps) {
  const [activeSection, setActiveSection] = useState('personal');

  // Scroll-based section detection: highlight the section whose top is closest
  // to (but not past) the reading line near the top of the viewport. This works
  // for short sections (e.g. Categories) that an intersection-ratio approach
  // would lose to taller neighbors.
  useEffect(() => {
    const sectionIds = ['personal', 'security', 'storage', 'categories', 'privacy', 'notifications', 'preferences', 'remove'];
    let rafId = 0;

    const updateActiveSection = () => {
      rafId = 0;
      const readingLine = window.innerHeight * 0.3; // 30% down the viewport

      let currentId: string | null = null;
      let currentTop = -Infinity;
      let firstVisibleId: string | null = null;
      let firstVisibleTop = Infinity;

      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.height === 0) continue;
        // Last section whose top is above the reading line wins
        if (rect.top <= readingLine && rect.top > currentTop) {
          currentTop = rect.top;
          currentId = id;
        }
        // Track topmost section still below the line (fallback when at very top)
        if (rect.top > readingLine && rect.top < firstVisibleTop) {
          firstVisibleTop = rect.top;
          firstVisibleId = id;
        }
      }

      const nextId = currentId || firstVisibleId;
      if (nextId) {
        setActiveSection(prev => (prev === nextId ? prev : nextId));
      }
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(updateActiveSection);
      }
    };

    // Capture phase so scrolls inside nested containers are caught too
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    // Initial run (delayed slightly so sections have rendered)
    const initialTimer = setTimeout(updateActiveSection, 150);

    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(initialTimer);
    };
  }, []);

  const sections: SettingsSection[] = [
    {
      id: 'personal',
      name: 'Personal Information',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <circle cx="12" cy="12" r="10" strokeWidth={2}/>
          <circle cx="12" cy="8" r="3" strokeWidth={2}/>
          <path d="M6.168 18.849A6 6 0 0 1 12 16a6 6 0 0 1 5.832 2.849" strokeWidth={2} strokeLinecap="round"/>
        </svg>
      )
    },
    {
      id: 'security',
      name: 'Account Security',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    },
    {
      id: 'storage',
      name: 'Storage Management',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
      )
    },
    {
      id: 'categories',
      name: 'Categories',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
        </svg>
      )
    },
    // {
    //   id: 'privacy',
    //   name: 'Privacy Settings',
    //   icon: (
    //     <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
    //       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    //     </svg>
    //   )
    // },
    {
      id: 'notifications',
      name: 'Notification Preferences',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM12 3v13.5m0 0l-3-3m3 3l3-3M3 3h6m6 0h6" />
        </svg>
      )
    },
    // {
    //   id: 'preferences',
    //   name: 'App Preferences',
    //   icon: (
    //     <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
    //       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    //       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    //     </svg>
    //   )
    // },
    {
      id: 'remove',
      name: 'Remove Account',
      isDangerous: true,
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      )
    }
  ];

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      });
      setActiveSection(sectionId);
    }
  };

  if (isStacked) {
    return (
      <div className="flex flex-col h-full">
        {/* Toggle Button */}
        {canToggle && (
          <button
            onClick={onToggleExpansion}
            className="flex items-center justify-center h-16 border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        
        {/* Stacked Icons */}
        <div className="flex-1 py-4">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={`w-full flex items-center justify-center h-12 mx-2 mb-2 rounded-lg transition-all duration-200 ${
                activeSection === section.id
                  ? 'bg-[#6C60FF]/10 text-[#6C60FF]'
                  : section.isDangerous
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              title={section.name}
            >
              <div className="w-5 h-5">
                {section.icon}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
        </div>
        {canToggle && (
          <button
            onClick={onToggleExpansion}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">Quick navigation</p>
          
          <nav className="space-y-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                  activeSection === section.id
                    ? 'bg-[#6C60FF]/10 text-[#6C60FF] border border-[#6C60FF]/20'
                    : section.isDangerous
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className={`w-5 h-5 ${
                  activeSection === section.id ? 'text-[#6C60FF]' : section.isDangerous ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {section.icon}
                </div>
                <span className="font-medium">{section.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}