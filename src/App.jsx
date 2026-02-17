import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { Plus, Trash2, Calendar, Target, Heart, GraduationCap, Plane, Wallet, ChevronRight, ChevronLeft, Save, X, Clock, Sun, Moon, LogOut, LogIn, Settings, Edit2, Wand2 } from 'lucide-react';
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
  const [editingDreamId, setEditingDreamId] = useState(null);

  // Dynamic Family Data
  const [familyProfile, setFamilyProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

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

  const handleEditDream = (dream) => {
    setNewDream({
      title: dream.title,
      category: dream.category,
      description: dream.description || '',
      month: dream.month
    });
    setSelectedFY(dream.fy);
    setEditingDreamId(dream.id);
    setIsModalOpen(true);
  };

  const handleSaveDream = async () => {
    if (!newDream.title || !user) return;
    try {
      if (!appId || !firebaseConfig || firebaseConfig.apiKey === 'change-me') {
        alert("Firebase not configured properly. Cannot save.");
        return;
      }

      if (editingDreamId) {
        // Update existing dream
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'dreams', editingDreamId), {
          ...newDream,
          updatedAt: new Date().toISOString()
        });
      } else {
        // Create new dream
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'dreams'), {
          ...newDream,
          fy: selectedFY,
          createdAt: new Date().toISOString(),
          userId: user.uid
        });
      }

      setIsModalOpen(false);
      setNewDream({ title: '', category: 'life', description: '', month: 4 });
      setEditingDreamId(null);
    } catch (e) {
      console.error("Save error:", e);
      alert("Failed to save dream: " + e.message);
    }
  };

  const handleAutoGenerateEvents = async () => {
    if (!familyProfile || !user) return;
    if (!confirm("家族の年齢に基づいて、入学・卒業などのライフイベントを自動生成しますか？\n（既存のデータは消えませんが、重複する可能性があります）")) return;

    setIsModalOpen(false); // Close other modals if open

    const newEvents = [];
    const batchPromises = [];

    familyProfile.members.forEach(member => {
      // School Events (Child/Student only)
      if (member.role === 'child' || member.role === 'student') {
        const isEarlyBird = member.birthMonth <= 3;
        // 小学校入学 (Grade 1 starts April of this year)
        const elemEntranceFY = isEarlyBird ? member.birthYear + 6 : member.birthYear + 7;

        const schoolEvents = [
          { fy: elemEntranceFY, title: `${member.name} 小学校入学`, category: 'education', month: 4 },
          { fy: elemEntranceFY + 6, title: `${member.name} 小学校卒業`, category: 'education', month: 3 },
          { fy: elemEntranceFY + 6, title: `${member.name} 中学校入学`, category: 'education', month: 4 },
          { fy: elemEntranceFY + 9, title: `${member.name} 中学校卒業`, category: 'education', month: 3 },
          { fy: elemEntranceFY + 9, title: `${member.name} 高校入学`, category: 'education', month: 4 },
          { fy: elemEntranceFY + 12, title: `${member.name} 高校卒業`, category: 'education', month: 3 },
          { fy: elemEntranceFY + 12, title: `${member.name} 大学入学`, category: 'education', month: 4 },
          { fy: elemEntranceFY + 16, title: `${member.name} 大学卒業`, category: 'education', month: 3 },
        ];

        schoolEvents.forEach(evt => newEvents.push(evt));

        // Coming of Age (20 years old)
        // 2022年4月1日から18歳成人ですが、式典は20歳が多いので一旦20歳で設定
        const comingOfAgeFY = isEarlyBird ? member.birthYear + 20 : member.birthYear + 20;
        // Example: Born 2000/04 -> 2021/01 (FY2020) :: 20yo 
        // Actually Coming of Age day is January. 
        // Born April 2, 2000 -> Turns 20 on April 2, 2020. Ceremony Jan 2021 (FY2020).
        // Born Mar 30, 2001 -> Turns 20 on Mar 30, 2021. Ceremony Jan 2021 (FY2020).
        // Logic: The FY they turn 20.
        // FY starts April YYYY. Ends Mar YYYY+1.
        // Ceremony is Jan YYYY+1. 
        // So it is the FY where: FY = BirthYear + 20 (if born Apr-Dec) or BirthYear + 19 (if born Jan-Mar)?
        // Wait. Born 2000 (Apr) -> FY2020 (turns 20). Jan 2021 is in FY2020. Correct.
        // Born 2001 (Mar) -> FY2020 (turns 20). Jan 2021 is in FY2020. Correct.
        // So distinct from school year logic? 
        // Early bird (Jan-Mar 2001) belongs to School Year starting Apr 2000. 
        // But age-wise, they turn 20 in 2021. 
        // Let's iterate simply by age for non-school events.

        // Actually, simplest is: Ceremony is usually the Jan of the FY they turn 20.
        // Born April 2000 -> 20 years old in April 2020. FY2020. Jan 2021 (FY2020).
        // Born March 2001 -> 20 years old in March 2021. FY2020. Jan 2021 (FY2020).
        // Yes, so it is roughly BirthYear + 20 (if Apr-Dec) or BirthYear + 19 (if Jan-Mar)?
        // No, let's look at Grade.
        // Grade 1: 6-7 years old.
        // 20 years old is roughly 14 years after Grade 1 entry?
        // Elem Entrance (6) -> +14 = 20. 
        // So elemEntranceFY + 14 is the FY they turn 20 (for school year cohort).
        newEvents.push({
          fy: elemEntranceFY + 13, // 19-20 years old? Wait.
          // Entrance (6) -> 1(7) -> 2(8)...
          // Grade 1 = 6-7.
          // Grade 14 = 19-20. (University 2nd year).
          // Coming of Age is usually 20. 
          // Let's put it at 20 years old.
          title: `${member.name} 成人式`, category: 'life', month: 1
        });
      }

      // Longevity Celebrations
      // Kanreki (60)
      // Born 1960 -> 60 in 2020. FY2020.
      const kanrekiFY = member.birthMonth <= 3 ? member.birthYear + 60 - 1 : member.birthYear + 60;
      if (kanrekiFY >= (familyProfile.startFY || 2024)) {
        newEvents.push({ fy: kanrekiFY, title: `${member.name} 還暦(60歳)`, category: 'life', month: member.birthMonth });
      }
    });

    try {
      // Filter existing to avoid exact duplicates? (Simple check)
      // For now just add. User can delete.

      const promises = newEvents.map(evt => {
        // Only add if within display range (StartFY to StartFY+20)
        const startFY = familyProfile.startFY || new Date().getFullYear();
        if (evt.fy >= startFY && evt.fy < startFY + 20) {
          return addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'dreams'), {
            ...evt,
            createdAt: new Date().toISOString(),
            userId: user.uid
          });
        }
        return Promise.resolve();
      });

      await Promise.all(promises);
      alert(`${promises.length}件のイベントを作成しました！`);
    } catch (e) {
      console.error("Auto generate error:", e);
      alert("Error: " + e.message);
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
        <div className="flex-1 flex justify-end items-start h-full gap-2">
          <button
            onClick={handleAutoGenerateEvents}
            className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-all"
            title="ライフイベント自動生成"
          >
            <Wand2 size={20} />
          </button>
          <button
            onClick={() => setIsEditingProfile(true)}
            className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-all"
            title="家族設定"
          >
            <Settings size={20} />
          </button>
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
                      className={`p-3 rounded-2xl border transition-colors ${member.gender === 'male'
                        ? 'bg-blue-50/50 border-blue-100 hover:border-blue-200'
                        : member.gender === 'female'
                          ? 'bg-rose-50/50 border-rose-100 hover:border-rose-200'
                          : 'bg-slate-50 border-slate-100'
                        }`}
                    >
                      <div className={`text-[9px] font-black uppercase tracking-widest flex justify-between items-center ${member.gender === 'male' ? 'text-blue-400' : member.gender === 'female' ? 'text-rose-400' : 'text-slate-400'
                        }`}>
                        <span>{member.name}</span>
                        <span className="opacity-50 text-[10px]">{member.gender === 'male' ? '👨' : member.gender === 'female' ? '👩' : ''}</span>
                      </div>

                      {member.role === 'child' || member.role === 'student' ? (
                        <>
                          <div className={`text-lg font-black ${member.gender === 'male' ? 'text-blue-700' : member.gender === 'female' ? 'text-rose-700' : 'text-slate-700'
                            }`}>{member.grade}</div>
                          <div className={`text-[10px] font-bold ${member.gender === 'male' ? 'text-blue-400' : member.gender === 'female' ? 'text-rose-400' : 'text-slate-400'
                            }`}>{member.age}歳</div>
                        </>
                      ) : (
                        <div className={`text-lg font-black ${member.gender === 'male' ? 'text-blue-900/80' : member.gender === 'female' ? 'text-rose-900/80' : 'text-slate-700'
                          }`}>{member.age}歳になる年</div>
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
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditDream(dream)}
                            className="text-slate-200 hover:text-indigo-400 transition-colors p-2"
                            title="編集"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteDream(dream.id)}
                            className="text-slate-200 hover:text-red-400 transition-colors p-2"
                            title="削除"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
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
                <p className="text-slate-400 text-xs font-bold mt-1 tracking-widest uppercase">
                  {editingDreamId ? 'EDITING DREAM' : 'PLANNING NEW DREAM'}
                </p>
              </div>
              <button
                onClick={() => { setIsModalOpen(false); setEditingDreamId(null); }}
                className="bg-slate-100 p-2 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
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
                onClick={handleSaveDream}
                disabled={!newDream.title}
                className="w-full bg-indigo-600 text-white font-black py-5 rounded-[1.8rem] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-30 flex items-center justify-center gap-3 text-lg"
              >
                <Save size={24} />
                {editingDreamId ? '変更を保存' : '年度プランに保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating User Info */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md shadow-2xl px-6 py-3 rounded-full border border-slate-100 text-[10px] font-black text-slate-400 tracking-[0.2em]">
        FinEdit Makikatsume
      </div>
    </div>
  );
}

export default App;
