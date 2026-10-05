import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { RoleCode, GlobalSearchItemDto } from '@workdesk/shared';
import {
  LogOut,
  Shield,
  User,
  Users,
  Search,
  CheckSquare,
  FolderGit2,
  Calendar,
  Video,
  FileText,
  Clock,
  Sparkles,
} from 'lucide-react';
import { AskWorkdeskModal } from './AskWorkdeskModal';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchItemDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = searchQuery.trim();
      if (q.length >= 2) {
        setIsSearching(true);
        try {
          const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`, {
            credentials: 'include',
          });
          if (res.ok) {
            const data = await res.json();
            setSearchResults(data?.results || []);
            setIsOpen(true);
          } else {
            setSearchResults([]);
          }
        } catch (err) {
          console.error('Search failed', err);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setIsOpen(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getRoleBadge = (role?: RoleCode) => {
    switch (role) {
      case RoleCode.ROLE_MANAGER:
        return {
          label: 'Manager (Governance & Org Control)',
          color: 'bg-purple-900/60 text-purple-300 border-purple-600/50',
          icon: Shield,
        };
      case RoleCode.ROLE_LEAD:
        return {
          label: 'Team Lead (Supervision)',
          color: 'bg-cyan-900/60 text-cyan-300 border-cyan-600/50',
          icon: Users,
        };
      case RoleCode.ROLE_EMPLOYEE:
      default:
        return {
          label: 'Employee (Execution)',
          color: 'bg-emerald-900/60 text-emerald-300 border-emerald-600/50',
          icon: User,
        };
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'TASK':
        return <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />;
      case 'PROJECT':
        return <FolderGit2 className="w-3.5 h-3.5 text-amber-400" />;
      case 'SPRINT':
        return <Clock className="w-3.5 h-3.5 text-blue-400" />;
      case 'MEETING':
        return <Video className="w-3.5 h-3.5 text-emerald-400" />;
      case 'STANDUP':
        return <Calendar className="w-3.5 h-3.5 text-orange-400" />;
      case 'DECISION':
        return <FileText className="w-3.5 h-3.5 text-cyan-400" />;
      default:
        return <Search className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const handleSelectResult = (item: GlobalSearchItemDto) => {
    setIsOpen(false);
    setSearchQuery('');
    navigate(item.linkUrl);
  };

  const badge = getRoleBadge(user?.roleCode);
  const Icon = badge.icon;

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/70 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
          W
        </div>
        <div>
          <span className="text-lg font-bold text-white tracking-tight">WorkDesk</span>
          <span className="text-xs text-slate-400 ml-2 hidden sm:inline border border-slate-700 rounded px-1.5 py-0.5">
            Control Tower
          </span>
        </div>
      </div>

      {/* Global Search Bar */}
      <div ref={searchRef} className="relative w-80 lg:w-96 hidden md:block">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Global search (Task, Project, Sprint, Decision)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setIsOpen(true);
            }}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {/* Search Results Dropdown */}
        {isOpen && (
          <div className="absolute left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50 max-h-96 overflow-y-auto">
            {searchResults.length === 0 ? (
              <div className="p-4 text-xs text-slate-500 text-center">
                No authorized results found for "{searchQuery}"
              </div>
            ) : (
              <div className="py-2">
                <div className="px-3 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Authorized Scope Results ({searchResults.length})
                </div>
                {searchResults.map((item) => (
                  <button
                    key={`${item.entityType}-${item.id}`}
                    onClick={() => handleSelectResult(item)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800/60 flex items-center justify-between gap-3 group transition-colors"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {getEntityIcon(item.entityType)}
                      <div className="truncate">
                        <div className="text-xs text-slate-200 font-medium group-hover:text-indigo-300 transition-colors truncate">
                          {item.ticketId && (
                            <span className="font-mono text-indigo-400 mr-1.5 font-bold">
                              {item.ticketId}
                            </span>
                          )}
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                      {item.entityType}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsAiOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600/30 to-purple-600/30 hover:from-indigo-600/50 hover:to-purple-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-semibold shadow-md shadow-indigo-600/10 transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Ask WorkDesk</span>
        </button>

        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
          <Icon className="w-3.5 h-3.5" />
          <span>{badge.label}</span>
        </div>

        <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-slate-200">{user?.fullName}</div>
            <div className="text-xs text-slate-400">{user?.email}</div>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800/80 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AskWorkdeskModal isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />
    </header>
  );
};
