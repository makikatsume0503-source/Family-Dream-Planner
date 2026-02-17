import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { Plus, Trash2, Calendar, Target, Heart, GraduationCap, Plane, Wallet, ChevronRight, ChevronLeft, Save, X, Clock, Sun, Moon, LogOut, LogIn } from 'lucide-react';
import { firebaseConfig, appId } from './config';
import FamilySetup from './components/FamilySetup';

// --- Firebase Configuration ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const CATEGORIES = [
  { id: 'education', label: '教育', icon: GraduationCap, color: 'bg-blue-500' },
  { id: 'travel', label: '旅行', icon: Plane, color: 'bg-green-500' },
  { id: 'financial', label: '家計・投資', icon: Wallet, color: 'bg-yellow-500' },
  { id: 'life', label: 'ライフ・夢', icon: Heart, color: 'bg-pink-500' },
  { id: 'career', label: '仕事', icon: Target, color: 'bg-purple-500' },
];

// 年度用の月の並び (4月〜翌3月)
const FY_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

function App() {
  const [user, setUser] = useState(null);
  const [dreams, setDreams] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFY, setSelectedFY] = useState(null);
  const [newDream, setNewDream] = useState({ title: '', category: 'life', description: '', month: 4 });

  // Dynamic Family Data
  const [familyProfile, setFamilyProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // --- Authentication ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsLoadingProfile(true);
      } else {
        setFamilyProfile(null);
        setDreams([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Login / Logout Handlers ---
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
      alert("ログインに失敗しました: " + error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // --- Fetch Family Profile ---
  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'artifacts', appId, 'settings', 'familyProfile');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setFamilyProfile(docSnap.data());
        } else {
          setFamilyProfile(null); // Trigger setup flow
        }
      } catch (e) {
        console.error("Profile fetch error:", e);
      } finally {
        setIsLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [user]);

  // --- Real-time Data Fetching ---
  useEffect(() => {
    if (!user) return;
    if (!appId || !firebaseConfig || firebaseConfig.apiKey === 'change-me') return;

    const dreamsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'dreams');
    const unsubscribe = onSnapshot(dreamsCollection, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDreams(docs);
    }, (error) => {
      console.error("Firestore error:", error);
    });
    return () => unsubscribe();
  }, [user]);

  // --- Logic ---
  const timelineData = useMemo(() => {
    if (!familyProfile) return [];

    const data = [];
    const startFY = familyProfile.startFY || new Date().getFullYear();

    for (let i = 0; i < 20; i++) {
      const fy = startFY + i;

      const getGrade = (birthYear, birthMonth, currentFY) => {
        const isEarlyBird = birthMonth <= 3;
        const entranceFY = isEarlyBird ? birthYear + 6 : birthYear + 7;
        const yearsSinceEntrance = currentFY - entranceFY + 1;

        if (yearsSinceEntrance < 1) return "未就学";
        if (yearsSinceEntrance <= 6) return `小${yearsSinceEntrance}`;
        if (yearsSinceEntrance <= 9) return `中${yearsSinceEntrance - 6}`;
        if (yearsSinceEntrance <= 12) return `高${yearsSinceEntrance - 9}`;
        if (yearsSinceEntrance <= 16) return `大${yearsSinceEntrance - 12}`;
        return "社会人";
      };

      const getAgeInFY = (birthYear, currentFY) => {
        return currentFY - birthYear;
      };

      const yearDreams = dreams
        .filter(d => d.fy === fy)
        .sort((a, b) => {
          const aIndex = FY_MONTHS.indexOf(a.month);
          const bIndex = FY_MONTHS.indexOf(b.month);
          return aIndex - bIndex;
        });

      const memberData = familyProfile.members.map(m => ({
        ...m,
        age: getAgeInFY(m.birthYear, fy),
        grade: m.role === 'child' || m.role === 'student' ? getGrade(m.birthYear, m.birthMonth, fy) : null
      }));

      data.push({
        fy,
        members: memberData,
        yearDreams
      });
    }
    return data;
  }, [familyProfile, dreams]);

  const handleAddDream = async () => {
    if (!newDream.title || !user) return;
    try {
      if (!appId || !firebaseConfig || firebaseConfig.apiKey === 'change-me') {
        alert("Firebase not configured properly. Cannot save.");
        return;
      }
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'dreams'), {
        ...newDream,
        fy: selectedFY,
        createdAt: new Date().toISOString(),
        userId: user.uid
      });
      setIsModalOpen(false);
      setNewDream({ title: '', category: 'life', description: '', month: 4 });
    } catch (e) {
      console.error("Add error:", e);
      alert("Failed to save dream: " + e.message);
    }
  };

  const handleDeleteDream = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'dreams', id));
    } catch (e) {
      console.error("Delete error:", e);
    }
  };

  // --- Rendering ---

  // 1. Not Logged In
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl max-w-md w-full text-center space-y-8">
          <div className="inline-flex items-center justify-center p-6 bg-indigo-50 rounded-full mb-2">
            <Target className="text-indigo-600" size={48} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 mb-2">家族のドリーム・プランナー</h1>
            <p className="text-slate-500 text-sm">家族の未来を、みんなで描こう。</p>
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-white border-2 border-slate-100 py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-200 transition-all group"
          >
            <LogIn className="text-slate-400 group-hover:text-indigo-500 transition-colors" size={20} />
            <span className="font-bold text-slate-600 group-hover:text-slate-800">Googleでログイン</span>
          </button>

          {firebaseConfig.apiKey === 'change-me' && (
            <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
              Demo Mode: Config not set.
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. Loading Profile
  if (isLoadingProfile && !familyProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-indigo-400 font-black tracking-widest text-sm">LOADING PLANNER...</div>
      </div>
    );
  }

  // 3. Setup (User logged in, but no profile)
  if (!familyProfile) {
    return <FamilySetup onSave={() => window.location.reload()} user={user} />;
  }

  // 4. Main App
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans p-4 pb-20">
      {/* Header */}
      <header className="max-w-4xl mx-auto mb-10 pt-8 flex items-center justify-between">
        <div className="flex-1"></div>
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-sm mb-4">
            <Target className="text-indigo-600" size={32} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            家族のドリーム・プランナー <span className="text-indigo-600">年度版</span>
          </h1>
        </div>
        <div className="flex-1 flex justify-end items-start h-full">
          <button
            onClick={handleLogout}
            className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            title="ログアウト"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {firebaseConfig.apiKey === 'change-me' && (
        <div className="max-w-md mx-auto mb-8 p-3 bg-amber-50 rounded-lg text-amber-800 text-sm border border-amber-200 text-center">
          ⚠️ Demo Mode: Update src/config.js
        </div>
      )}

      {/* Main Timeline */}
      <div className="max-w-4xl mx-auto space-y-6">
        {timelineData.map((item) => (
          <div key={item.fy} className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl transition-all duration-300 group">
            <div className="flex flex-col md:flex-row">
              {/* FY Sidebar */}
              <div className="bg-slate-900 text-white p-6 md:w-40 flex flex-col justify-center items-center text-center group-hover:bg-indigo-700 transition-colors">
                <span className="text-sm font-black text-indigo-400 mb-1">FISCAL YEAR</span>
                <span className="text-3xl font-black">{item.fy}</span>
                <span className="text-[10px] font-bold opacity-60 mt-2">年度</span>
                <div className="text-[9px] mt-4 font-medium opacity-40 leading-tight hidden md:block">
                  {item.fy}/04 - {item.fy + 1}/03
                </div>
              </div>

              {/* Family Status - Dynamic Grid */}
              <div className="p-6 flex-1">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  {item.members.map((member) => (
                    <div
                      key={member.id}
                      className={`p-3 rounded-2xl border ${member.role === 'child' || member.role === 'student'
                        ? 'bg-blue-50/40 border-blue-100'
                        : 'bg-slate-50 border-slate-100'
                        }`}
                    >
                      <div className={`text-[9px] font-black uppercase tracking-widest ${member.role === 'child' ? 'text-blue-500' : 'text-slate-400'
                        }`}>
                        {member.name}
                      </div>

                      {member.role === 'child' || member.role === 'student' ? (
                        <>
                          <div className="text-lg font-black text-blue-700">{member.grade}</div>
                          <div className="text-[10px] text-blue-400 font-bold">{member.age}歳</div>
                        </>
                      ) : (
                        <div className="text-lg font-black text-slate-700">{member.age}歳になる年</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Dreams for this FY */}
                <div className="space-y-3">
                  {item.yearDreams.map((dream) => {
                    const CatIcon = CATEGORIES.find(c => c.id === dream.category)?.icon || Heart;
                    const catColor = CATEGORIES.find(c => c.id === dream.category)?.color || 'bg-slate-400';
                    return (
                      <div key={dream.id} className="flex items-center justify-between bg-white border border-slate-100 p-4 rounded-2xl hover:border-indigo-200 hover:shadow-sm transition-all">
                        <div className="flex items-center gap-5">
                          <div className="flex flex-col items-center justify-center min-w-[48px] border-r border-slate-100 pr-4">
                            <span className="text-indigo-600 font-black text-xl leading-none">{dream.month}</span>
                            <span className="text-[9px] font-black text-indigo-300 uppercase tracking-tighter">MONTH</span>
                          </div>
                          <div className={`${catColor} p-2.5 rounded-xl text-white`}>
                            <CatIcon size={20} />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 leading-tight">{dream.title}</h4>
                            {dream.description && <p className="text-xs text-slate-500 mt-1">{dream.description}</p>}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteDream(dream.id)}
                          className="text-slate-200 hover:text-red-400 transition-colors p-2"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    );
                  })}

                  <button
                    onClick={() => { setSelectedFY(item.fy); setIsModalOpen(true); }}
                    className="w-full py-4 border-2 border-dashed border-slate-100 text-slate-300 rounded-[1.5rem] hover:border-indigo-200 hover:text-indigo-400 hover:bg-indigo-50/20 transition-all flex items-center justify-center gap-2 text-sm font-bold"
                  >
                    <Plus size={20} />
                    {item.fy}年度の計画・夢を追加
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Dream Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl animate-in zoom-in duration-300">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  {selectedFY}年度の予定
                </h2>
                <p className="text-slate-400 text-xs font-bold mt-1 tracking-widest uppercase">Planning New Dream</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="bg-slate-100 p-2 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Month Selection - FY Order */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">実行する月を選択</label>
                <div className="grid grid-cols-4 gap-2">
                  {FY_MONTHS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setNewDream({ ...newDream, month: m })}
                      className={`py-3 rounded-2xl text-sm font-black transition-all border-2 ${newDream.month === m
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200'
                        : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'
                        }`}
                    >
                      {m}月
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">夢・予定のタイトル</label>
                <input
                  type="text"
                  value={newDream.title}
                  onChange={(e) => setNewDream({ ...newDream, title: e.target.value })}
                  className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 outline-none transition-all font-bold text-slate-700"
                  placeholder="例: 中学校入学、夏休み旅行、NISA積立増額"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">カテゴリー</label>
                <div className="grid grid-cols-5 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setNewDream({ ...newDream, category: cat.id })}
                      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${newDream.category === cat.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                        : 'border-slate-50 text-slate-400 hover:bg-slate-50'
                        }`}
                    >
                      <cat.icon size={24} />
                      <span className="text-[10px] font-black">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleAddDream}
                disabled={!newDream.title}
                className="w-full bg-indigo-600 text-white font-black py-5 rounded-[1.8rem] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-30 flex items-center justify-center gap-3 text-lg"
              >
                <Save size={24} />
                年度プランに保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating User Info */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md shadow-2xl px-6 py-3 rounded-full border border-slate-100 text-[10px] font-black text-slate-400 tracking-[0.2em]">
        FAMILY CFO | DASHBOARD | {user?.uid?.slice(0, 8) || 'GUEST'}
      </div>
    </div>
  );
}

export default App;
