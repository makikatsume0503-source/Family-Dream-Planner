import React, { useState } from 'react';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { User, Users, Calendar, Save, Plus, Trash2, Baby, GraduationCap, Briefcase } from 'lucide-react';
import { appId } from '../config';

const ROLES = [
    { id: 'parent', label: '親', icon: Briefcase },
    { id: 'child', label: '子供', icon: Baby },
    { id: 'student', label: '学生', icon: GraduationCap },
];

export default function FamilySetup({ onSave, user }) {
    const [startFY, setStartFY] = useState(new Date().getMonth() < 3 ? new Date().getFullYear() - 1 : new Date().getFullYear());
    const [members, setMembers] = useState([
        { id: crypto.randomUUID(), name: '', birthYear: 1980, birthMonth: 1, role: 'parent' },
        { id: crypto.randomUUID(), name: '', birthYear: 2015, birthMonth: 4, role: 'child' }
    ]);
    const [isSaving, setIsSaving] = useState(false);

    const db = getFirestore();

    const handleAddMember = () => {
        setMembers([...members, { id: crypto.randomUUID(), name: '', birthYear: 2020, birthMonth: 1, role: 'child' }]);
    };

    const handleRemoveMember = (id) => {
        setMembers(members.filter(m => m.id !== id));
    };

    const updateMember = (id, field, value) => {
        setMembers(members.map(m => m.id === id ? { ...m, [field]: value } : m));
    };

    const handleSave = async () => {
        if (members.some(m => !m.name)) {
            alert("Please enter names for all family members.");
            return;
        }

        setIsSaving(true);
        try {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'settings', 'familyProfile'), {
                startFY: parseInt(startFY),
                members: members.map(m => ({
                    ...m,
                    birthYear: parseInt(m.birthYear),
                    birthMonth: parseInt(m.birthMonth)
                })),
                updatedAt: new Date().toISOString(),
                updatedBy: user?.uid
            });
            if (onSave) onSave();
        } catch (error) {
            console.error("Error saving profile:", error);
            alert("Project ID mismatch or permission error. Check config.js");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white max-w-2xl w-full rounded-[2.5rem] shadow-2xl p-8 md:p-12 animate-in fade-in zoom-in duration-500">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center p-4 bg-indigo-50 rounded-full mb-4 text-indigo-600">
                        <Users size={48} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 mb-2">家族の設定</h1>
                    <p className="text-slate-500">ドリームプランナーを始めるために、<br />家族構成を教えてください。</p>
                </div>

                <div className="space-y-8">
                    {/* Start FY */}
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                            開始年度 (Start Fiscal Year)
                        </label>
                        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                            <Calendar className="text-slate-400" />
                            <input
                                type="number"
                                value={startFY}
                                onChange={(e) => setStartFY(e.target.value)}
                                className="bg-transparent font-black text-xl text-slate-700 outline-none w-full"
                            />
                            <span className="text-sm font-bold text-slate-400">年度から</span>
                        </div>
                    </div>

                    {/* Members */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                家族メンバー ({members.length}人)
                            </label>
                        </div>

                        {members.map((member, index) => (
                            <div key={member.id} className="bg-white border-2 border-slate-100 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center hover:border-indigo-100 transition-colors shadow-sm">
                                <div className="bg-slate-100 p-3 rounded-xl text-slate-400">
                                    <User size={20} />
                                </div>

                                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 w-full">
                                    <div className="md:col-span-4">
                                        <label className="text-[10px] font-bold text-slate-300 block mb-1">お名前</label>
                                        <input
                                            type="text"
                                            placeholder="名前"
                                            value={member.name}
                                            onChange={(e) => updateMember(member.id, 'name', e.target.value)}
                                            className="w-full font-bold text-slate-700 outline-none border-b-2 border-transparent focus:border-indigo-200 transition-colors"
                                        />
                                    </div>

                                    <div className="md:col-span-3">
                                        <label className="text-[10px] font-bold text-slate-300 block mb-1">生まれ年</label>
                                        <input
                                            type="number"
                                            placeholder="YYYY"
                                            value={member.birthYear}
                                            onChange={(e) => updateMember(member.id, 'birthYear', e.target.value)}
                                            className="w-full font-bold text-slate-700 outline-none"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="text-[10px] font-bold text-slate-300 block mb-1">誕生月</label>
                                        <select
                                            value={member.birthMonth}
                                            onChange={(e) => updateMember(member.id, 'birthMonth', e.target.value)}
                                            className="w-full font-bold text-slate-700 outline-none bg-transparent"
                                        >
                                            {[...Array(12)].map((_, i) => (
                                                <option key={i + 1} value={i + 1}>{i + 1}月</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="md:col-span-3">
                                        <label className="text-[10px] font-bold text-slate-300 block mb-1">役割</label>
                                        <select
                                            value={member.role}
                                            onChange={(e) => updateMember(member.id, 'role', e.target.value)}
                                            className="w-full font-bold text-slate-700 outline-none bg-transparent"
                                        >
                                            {ROLES.map(r => (
                                                <option key={r.id} value={r.id}>{r.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleRemoveMember(member.id)}
                                    className="text-slate-300 hover:text-red-400 p-2 transition-colors"
                                    disabled={members.length <= 1}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}

                        <button
                            onClick={handleAddMember}
                            className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={20} />
                            家族を追加する
                        </button>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full bg-indigo-600 text-white font-black py-5 rounded-[1.8rem] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 text-lg mt-8"
                    >
                        {isSaving ? (
                            <span className="animate-pulse">保存中...</span>
                        ) : (
                            <>
                                <Save size={24} />
                                設定を保存してはじめる
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
