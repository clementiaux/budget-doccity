// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Download, Edit2, Trash2, Plus, Settings, Save, X, Search, ArrowUpDown, LogOut, User, Calendar } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC8UXwghqNCTJc703ZICZj3-_yZ9t9PntY",
  authDomain: "budget-marseille.firebaseapp.com",
  projectId: "budget-marseille",
  storageBucket: "budget-marseille.firebasestorage.app",
  messagingSenderId: "580135397481",
  appId: "1:580135397481:web:0b8aa26a9c73f34c5e9af8",
  measurementId: "G-Z2TM6BVKER"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'budget-marseille';

const formatCurrency = (val) => `${val.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
const MONTHNAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const SHORTMONTHS = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUI', 'JUIL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];
const YEARS = [2026, 2027, 2028, 2029, 2030];

const DEFAULT_ENVELOPES = [
  { id: 'Honoraires Exterieurs', name: 'Honoraires Exterieurs', allocatedAmount: 120000 },
  { id: 'Maintenance', name: 'Maintenance', allocatedAmount: 135000 },
  { id: 'Energies - Fluides', name: 'Energies - Fluides', allocatedAmount: 100000 },
  { id: 'Informatique', name: 'Informatique', allocatedAmount: 12000 },
  { id: 'Consommables', name: 'Consommables', allocatedAmount: 9000 },
  { id: 'Evenements Généraux (Hors)', name: 'Evenements Généraux (Hors)', allocatedAmount: 9000 },
  { id: 'Services', name: 'Services', allocatedAmount: 135000 },
  { id: 'Charges exceptionnelles', name: 'Charges exceptionnelles', allocatedAmount: 10000 },
  { id: 'Charges copropriété', name: 'Charges copropriété', allocatedAmount: 20000 },
  { id: 'Assurances', name: 'Assurances', allocatedAmount: 13500 },
  { id: 'Taxes', name: 'Taxes', allocatedAmount: 155000 },
  { id: 'Lifesciences Services', name: 'Lifesciences Services', allocatedAmount: 33000 },
  { id: 'Lifesciences Travaux (remboursable)', name: 'Lifesciences Travaux (remboursable)', allocatedAmount: 0 }
];

const DEFAULT_SUB_CATEGORIES = {
  'Honoraires Exterieurs': ['RUS', 'Bureau de Contrôle', 'Décrets BACS & Tertiaires', 'AMO', 'Gardiennage / Télésurveillance', 'Accueil', 'SSIAP'],
  'Maintenance': ['CVC', 'Désenfumage', 'SSI', 'CFO/CFA', 'Portes / barrières automatiques', 'Ascenseurs', 'Plomberie', 'Défibrillateur', 'Travaux Maintenance (GER)', 'Réparations diverses'],
  'Energies - Fluides': ['Eau', 'Electricité', 'Chauffage'],
  'Informatique': ['Fibre', 'Vidéosurveillance', 'Wifi & Hotline', 'Location matériel informatique'],
  'Consommables': ['Achats responsables de centre'],
  'Evenements Généraux (Hors)': ['Evènements généraux'],
  'Services': ['Ménage', 'Espaces Verts Entretien', 'Gestion Déchets', 'DASRI Médical', 'Café/fourniture', 'Restauration', 'Conciergerie', 'Fontaine à eau', 'Gestion parking', 'IRVE (bornes de recharge électrique)'],
  'Charges exceptionnelles': ['Charge exceptionnelle'],
  'Charges copropriété': ['Charge copropriété'],
  'Assurances': ['Assurance'],
  'Taxes': ['Taxes bureaux', 'Taxes foncières', 'Autres taxes'],
  'Lifesciences Services': ['LS - DASRI', 'LS - Fourniture Gaz', 'LS - Maintenance air comprimé', 'LS - Maintenance gaz', 'LS - Réservation salles', 'LS - Groupes électrogènes', 'LS - Laverie - Production eau', 'LS - Laverie - Laveurs', 'LS - Laverie - Autoclave', 'LS - Consommables', 'LS - Sorbonnes & armoires ventilée', 'LS - Back-up frigorifiques', 'LS - Petits travaux', 'LS - Mise à gris / Mise à blanc', 'LS - Evènementiel', 'Charges exceptionnelles'],
  'Lifesciences Travaux (remboursable)': ['LS - Mobilier', 'LS - Réseau gaz', 'LS - Plomberie', 'LS - Electricité', 'LS - CVC', 'LS - Cloisons', 'LS - Gros œuvre']
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isDBReady, setIsDBReady] = useState(false);
  const [usersConfig, setUsersConfig] = useState({ users: [], pending: [] });
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);
  
  const [activeTab, setActiveTab] = useState('saisie');
  const [selectedYear, setSelectedYear] = useState(2026);
  
  const [expenses, setExpenses] = useState([]);
  const [envelopes, setEnvelopes] = useState([]);
  const [subCategoriesMap, setSubCategoriesMap] = useState({});

  const allowedUsers = [
    { email: 'finance@doc-city.fr', password: 'Doccityviton2026', name: 'Direction', role: 'Administrateur' },
    { email: 'compta@doccity.fr', password: 'doccity2026', name: 'Service Comptabilité', role: 'Éditeur' }
  ];

  useEffect(() => {
    signInAnonymously(auth);
    const unsubscribe = onAuthStateChanged(auth, setFirebaseUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'budget_setup');
    const unsubConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setEnvelopes(data.envelopes || []);
        setSubCategoriesMap(data.subCategoriesMap || {});
        setIsDBReady(true);
      } else {
        setDoc(configRef, { envelopes: DEFAULT_ENVELOPES, subCategoriesMap: DEFAULT_SUB_CATEGORIES });
      }
    });

    const expensesRef = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');
    const unsubExpenses = onSnapshot(expensesRef, (snapshot) => {
      const expData = [];
      snapshot.forEach(docSnap => expData.push({ id: docSnap.id, ...docSnap.data() }));
      setExpenses(expData);
    });

    const usersAuthRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'users_auth');
    const unsubUsers = onSnapshot(usersAuthRef, (docSnap) => {
      if (docSnap.exists()) {
        setUsersConfig(docSnap.data());
      } else {
        setDoc(usersAuthRef, { users: [], pending: [] });
      }
    });

    return () => { unsubConfig(); unsubExpenses(); unsubUsers(); };
  }, [firebaseUser]);

  const updateConfig = async (newEnvelopes, newMap) => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'budget_setup'), {
      envelopes: newEnvelopes,
      subCategoriesMap: newMap
    });
  };

  const SaisieTab = () => {
    const [desc, setDesc] = useState('');
    const [date, setDate] = useState('');
    const [cat, setCat] = useState(envelopes.length > 0 ? envelopes[0].id : '');
    const [sub, setSub] = useState(cat && subCategoriesMap[cat] ? subCategoriesMap[cat][0] : '');
    const [amount, setAmount] = useState('');
    const [isProvisional, setIsProvisional] = useState(false);
    const [editId, setEditId] = useState(null);
    const [expenseToDelete, setExpenseToDelete] = useState(null); // Fix confirmation
    
    const [filterCat, setFilterCat] = useState('');
    const [filterSub, setFilterSub] = useState('');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [sortField, setSortField] = useState('date');
    const [sortOrder, setSortOrder] = useState('desc'); 

    const handleAddOrEdit = async (e) => {
      e.preventDefault();
      if (!desc || !amount || !date || !cat) return;
      
      const payload = { 
        date, 
        description: desc, 
        amount: parseFloat(amount), 
        categoryId: cat, 
        subCategory: sub,
        isProvisional: isProvisional
      };
      
      if (editId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', editId), payload);
        setEditId(null);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), payload);
      }
      setDesc(''); setAmount(''); setDate(''); setIsProvisional(false);
    };

    const handleEditClick = (expense) => {
      setDesc(expense.description); 
      setDate(expense.date); 
      setCat(expense.categoryId); 
      setSub(expense.subCategory); 
      setAmount(expense.amount); 
      setIsProvisional(expense.isProvisional || false);
      setEditId(expense.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const executeDeleteExpense = async (id) => {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', id));
      setExpenseToDelete(null);
    };

    let filtered = expenses.filter(ex => {
      if (new Date(ex.date).getFullYear() !== selectedYear) return false;
      if (filterCat && ex.categoryId !== filterCat) return false;
      if (filterSub && ex.subCategory !== filterSub) return false;
      if (minAmount && ex.amount < parseFloat(minAmount)) return false;
      if (maxAmount && ex.amount > parseFloat(maxAmount)) return false;
      return true;
    });

    filtered.sort((a, b) => {
      let valA = a[sortField]; let valB = b[sortField];
      if (sortField === 'date') { valA = new Date(valA).getTime(); valB = new Date(valB).getTime(); }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const exportCSV = () => {
      const headers = ['Date', 'Description', 'Statut', 'Catégorie', 'Sous-Catégorie', 'Montant'];
      const rows = filtered.map(ex => `"${ex.date}";"${ex.description.replace(/"/g, '""')}";"${ex.isProvisional ? 'Prévisionnel' : 'Facture Validée'}";"${ex.categoryId}";"${ex.subCategory}";"${ex.amount}"`);
      const csvContent = [headers.join(';'), ...rows].join('\n');
      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = `depenses_${selectedYear}.csv`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    return (
      <div className="space-y-6">
        <form onSubmit={handleAddOrEdit} className={`p-6 rounded-xl border shadow-sm grid grid-cols-1 md:grid-cols-6 gap-4 ${editId ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
          <div className="col-span-full mb-2 font-bold text-gray-700 flex justify-between">
            {editId ? 'Modifier la dépense' : 'Saisir une nouvelle dépense'}
            {editId && <button type="button" onClick={() => {setEditId(null); setDesc(''); setAmount(''); setDate(''); setIsProvisional(false);}} className="text-red-500 text-sm hover:underline">Annuler la modification</button>}
          </div>
          <input className="border p-2 rounded" placeholder="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <input className="border p-2 rounded" placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} required />
          <select className="border p-2 rounded" value={cat} onChange={(e) => { setCat(e.target.value); setSub(subCategoriesMap[e.target.value]?.[0] || ''); }}>
            {envelopes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select className="border p-2 rounded" value={sub} onChange={(e) => setSub(e.target.value)}>
            {subCategoriesMap[cat]?.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="border p-2 rounded" placeholder="Montant (€)" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          
          <label className={`flex items-center justify-center gap-2 border p-2 rounded cursor-pointer transition-colors ${isProvisional ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
            <input type="checkbox" checked={isProvisional} onChange={(e) => setIsProvisional(e.target.checked)} className="w-4 h-4 cursor-pointer" />
            <span className="text-sm font-semibold select-none">{isProvisional ? 'Prévisionnel' : 'Facture Validée'}</span>
          </label>

          <button className={`${editId ? 'bg-green-600' : 'bg-blue-600'} text-white p-2 rounded col-span-full font-bold flex justify-center items-center gap-2 hover:opacity-90`}>
            {editId ? <Save size={18} /> : <Plus size={18} />}
            {editId ? 'Mettre à jour' : 'Ajouter Dépense'}
          </button>
        </form>

        {}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex flex-col md:flex-row justify-between mb-4 gap-4 items-center">
            <h2 className="font-bold text-lg">Historique partagé des saisies ({selectedYear})</h2>
            <button onClick={exportCSV} className="bg-green-100 text-green-700 px-4 py-2 rounded font-semibold flex items-center gap-2 hover:bg-green-200">
              <Download size={18} /> Exporter CSV
            </button>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg mb-4 grid grid-cols-1 md:grid-cols-4 gap-4 border">
            <div>
              <label className="text-xs text-gray-500 font-semibold mb-1 block">Filtrer par Catégorie</label>
              <select className="border p-2 rounded w-full bg-white" value={filterCat} onChange={(e) => {setFilterCat(e.target.value); setFilterSub('');}}>
                <option value="">Toutes</option>
                {envelopes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold mb-1 block">Filtrer par Sous-Catégorie</label>
              <select className="border p-2 rounded w-full bg-white" value={filterSub} onChange={(e) => setFilterSub(e.target.value)} disabled={!filterCat}>
                <option value="">Toutes</option>
                {filterCat && subCategoriesMap[filterCat]?.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold mb-1 block">Montant Min (€)</label>
              <input type="number" placeholder="Ex: 100" className="border p-2 rounded w-full bg-white" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold mb-1 block">Montant Max (€)</label>
              <input type="number" placeholder="Ex: 5000" className="border p-2 rounded w-full bg-white" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
            </div>
          </div>

          {}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left cursor-pointer hover:bg-gray-200" onClick={() => { setSortField('date'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>Date</th>
                  <th className="p-3 text-left">Description</th>
                  <th className="p-3 text-left">Catégorie</th>
                  <th className="p-3 text-right cursor-pointer hover:bg-gray-200" onClick={() => { setSortField('amount'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>Montant</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ex => (
                  <tr key={ex.id} className={`border-b transition-colors ${ex.isProvisional ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'hover:bg-gray-50'}`}>
                    <td className="p-3 whitespace-nowrap font-medium">{new Date(ex.date).toLocaleDateString('fr-FR')}</td>
                    <td className="p-3">
                      {ex.description}
                      {ex.isProvisional && <span className="ml-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full uppercase font-bold tracking-wider inline-block">Prévisionnel</span>}
                    </td>
                    <td className={`p-3 ${ex.isProvisional ? 'text-red-600' : 'text-gray-600'}`}>
                      <span className={`font-semibold ${ex.isProvisional ? 'text-red-700' : 'text-gray-800'}`}>{ex.categoryId}</span> <br/> {ex.subCategory}
                    </td>
                    <td className="p-3 text-right font-bold">{formatCurrency(ex.amount)}</td>
                    <td className="p-3 text-center">
                      {expenseToDelete === ex.id ? (
                        <div className="flex justify-center items-center gap-1">
                          <span className="text-[10px] text-red-600 font-bold">Confirmer?</span>
                          <button onClick={() => executeDeleteExpense(ex.id)} className="bg-red-600 text-white p-1 rounded hover:bg-red-700"><Trash2 size={16} /></button>
                          <button onClick={() => setExpenseToDelete(null)} className="bg-gray-200 p-1 rounded hover:bg-gray-300"><X size={16} /></button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => handleEditClick(ex)} className={`${ex.isProvisional ? 'text-red-800 hover:bg-red-200' : 'text-blue-600 hover:bg-blue-100'} p-1 mx-1 rounded`}><Edit2 size={16} /></button>
                          <button onClick={() => setExpenseToDelete(ex.id)} className={`text-red-600 p-1 mx-1 ${ex.isProvisional ? 'hover:bg-red-200' : 'hover:bg-red-100'} rounded`}><Trash2 size={16} /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan="5" className="p-4 text-center text-gray-500 italic">Aucune dépense trouvée pour {selectedYear} selon vos critères.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const SuiviTab = () => {
    const [selectedMonths, setSelectedMonths] = useState([new Date().getMonth()]);
    const toggleMonth = (mIndex) => {
      if (selectedMonths.includes(mIndex)) {
        if(selectedMonths.length > 1) setSelectedMonths(selectedMonths.filter(m => m !== mIndex));
      } else { setSelectedMonths([...selectedMonths, mIndex]); }
    };

    const filteredExpenses = expenses.filter(ex => 
      selectedMonths.includes(new Date(ex.date).getMonth()) && 
      new Date(ex.date).getFullYear() === selectedYear
    );
    
    const monthRatio = selectedMonths.length / 12;
    let totalBudget = 0; let totalSpent = 0;

    const categoryStats = envelopes.map(env => {
      const proratedBudget = env.allocatedAmount * monthRatio;
      const envExpenses = filteredExpenses.filter(ex => ex.categoryId === env.id);
      const spent = envExpenses.reduce((sum, ex) => sum + ex.amount, 0);
      
      const subCatTotals = {};
      envExpenses.forEach(ex => {
        const key = `${ex.subCategory}_${ex.isProvisional ? 'prev' : 'val'}`;
        if(!subCatTotals[key]) {
          subCatTotals[key] = {
            name: ex.subCategory,
            isProvisional: !!ex.isProvisional,
            amount: 0
          };
        }
        subCatTotals[key].amount += ex.amount;
      });

      totalBudget += proratedBudget; totalSpent += spent;
      return { ...env, proratedBudget, spent, remaining: proratedBudget - spent, subCatTotals };
    });

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h2 className="font-bold text-xl mb-4 flex items-center gap-2"><Calendar size={20} className="text-blue-600"/> Sélection des mois de {selectedYear}</h2>
          <div className="flex flex-wrap gap-2">
            {SHORTMONTHS.map((m, i) => (
              <button key={i} onClick={() => toggleMonth(i)} className={`px-4 py-2 rounded-full font-semibold text-sm border ${selectedMonths.includes(i) ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col justify-center items-center">
            <p className="text-gray-500 font-semibold mb-1">Budget Alloué (Proratisé)</p>
            <p className="text-3xl font-bold text-blue-600">{formatCurrency(totalBudget)}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col justify-center items-center">
            <p className="text-gray-500 font-semibold mb-1">Dépensé sur la période</p>
            <p className="text-3xl font-bold text-red-500">{formatCurrency(totalSpent)}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col justify-center items-center">
            <p className="text-gray-500 font-semibold mb-1">Reste à allouer</p>
            <p className={`text-3xl font-bold ${totalBudget - totalSpent >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalBudget - totalSpent)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h2 className="font-bold text-lg mb-6">Suivi par Enveloppe et Sous-catégories</h2>
          <div className="space-y-8">
            {categoryStats.map(stat => {
              const pct = stat.proratedBudget > 0 ? Math.min((stat.spent / stat.proratedBudget) * 100, 100) : (stat.spent > 0 ? 100 : 0);
              const subCatsPresent = Object.keys(stat.subCatTotals).length > 0;

              return (
                <div key={stat.id} className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-bold text-gray-800">{stat.name}</span>
                    <span className="text-gray-600 font-semibold">{formatCurrency(stat.spent)} / {formatCurrency(stat.proratedBudget)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                    <div className={`h-3 rounded-full transition-all ${stat.spent > stat.proratedBudget ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }}></div>
                  </div>
                  
                  {subCatsPresent && (
                    <div className="flex flex-wrap gap-2 mt-3 ml-2 border-l-2 border-gray-200 pl-3">
                      {Object.values(stat.subCatTotals).sort((a,b)=>b.amount-a.amount).map((sub) => {
                         const subPct = stat.spent > 0 ? ((sub.amount / stat.spent) * 100).toFixed(1) : 0;
                         return (
                           <div key={`${sub.name}-${sub.isProvisional}`} className={`text-xs border px-3 py-1.5 rounded-md shadow-sm flex items-center gap-2 ${sub.isProvisional ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                              <span className="uppercase">
                                {sub.name} 
                                <span className={sub.isProvisional ? 'font-bold text-red-600 ml-1' : 'font-bold text-green-600 ml-1'}>
                                  {sub.isProvisional ? '(Prév)' : '(Validé)'}
                                </span>
                              </span>
                              <span className={`font-bold px-2 py-0.5 rounded border bg-white ${sub.isProvisional ? 'text-red-700' : 'text-gray-900'}`}>
                                {formatCurrency(sub.amount)} ({subPct}%)
                              </span>
                           </div>
                         );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const EnveloppesTab = () => {
    const getMatrixData = () => {
      const data = {};
      envelopes.forEach(env => {
        const monthly = Array(12).fill(0);
        expenses.filter(ex => ex.categoryId === env.id && new Date(ex.date).getFullYear() === selectedYear).forEach(ex => { 
          monthly[new Date(ex.date).getMonth()] += ex.amount; 
        });
        const cumulative = []; let sum = 0;
        monthly.forEach(val => { sum += val; cumulative.push(sum); });
        data[env.id] = { monthly, cumulative };
      });
      return data;
    };
    
    const matrixData = getMatrixData();

    const getRowTotals = (envList) => {
      let totalPlafond = envList.reduce((sum, e) => sum + (e.allocatedAmount / 12), 0);
      let monthlySum = Array(12).fill(0); let cumulativeSum = Array(12).fill(0);
      envList.forEach(env => {
        const d = matrixData[env.id];
        for(let m = 0; m < 12; m++) { monthlySum[m] += d.monthly[m]; cumulativeSum[m] += d.cumulative[m]; }
      });
      return { totalPlafond, monthlySum, cumulativeSum };
    };

    const allTotals = getRowTotals(envelopes);

    const exportMatrixCSV = () => {
      let headers = ['Enveloppes', 'Plafond Mensuel'];
      MONTHNAMES.forEach(m => headers.push(`${m} - Realisé`, `${m} - Cumul`, `${m} - Indicateur`));
      const csvRows = [headers.join(';')];
      envelopes.forEach(env => {
        const row = [`"${env.name}"`, (env.allocatedAmount/12).toFixed(2)];
        for (let m = 0; m < 12; m++) {
          const spent = matrixData[env.id].monthly[m];
          const cum = matrixData[env.id].cumulative[m];
          const deltaCum = (env.allocatedAmount/12)*(m+1) - cum;
          row.push(spent.toFixed(2), cum.toFixed(2), deltaCum.toFixed(2));
        }
        csvRows.push(row.join(';'));
      });
      
      let rowTotal = ['"Total Immeuble"', allTotals.totalPlafond.toFixed(2)];
      for(let m = 0; m < 12; m++) {
        rowTotal.push(allTotals.monthlySum[m].toFixed(2), allTotals.cumulativeSum[m].toFixed(2), '-');
      }
      csvRows.push(rowTotal.join(';'));

      let rowObj = ['"Budget Mensuel objectif"', '-'];
      let rowDelta = ['"Delta Mensuel ( Rea VS Obj )"', '-'];
      let rowSuivi = ['"Suivi Mensuel ( Euros )"', '-'];
      let rowShare = ['"Share Mensuel ( % )"', '-'];
      
      const totalAnnuel = allTotals.cumulativeSum[11] || 1;
      
      for(let m = 0; m < 12; m++) {
        const obj = allTotals.totalPlafond;
        const cumObj = obj * (m+1);
        const real = allTotals.monthlySum[m];
        const cumReal = allTotals.cumulativeSum[m];
        
        const deltaPct = obj > 0 ? ((real - obj) / obj) * 100 : 0;
        const cumDeltaPct = cumObj > 0 ? ((cumReal - cumObj) / cumObj) * 100 : 0;
        const sharePct = (real / totalAnnuel) * 100;
        const cumSharePct = (cumReal / totalAnnuel) * 100;
        
        rowObj.push(obj.toFixed(2), cumObj.toFixed(2), '-');
        rowDelta.push(`"${deltaPct.toFixed(1)}%"`, `"${cumDeltaPct.toFixed(1)}%"`, '-');
        rowSuivi.push(obj.toFixed(2), cumObj.toFixed(2), '-');
        rowShare.push(`"${sharePct.toFixed(1)}%"`, `"${cumSharePct.toFixed(1)}%"`, '-');
      }
      
      csvRows.push(rowObj.join(';'), rowDelta.join(';'), rowSuivi.join(';'), rowShare.join(';'));

      const blob = new Blob(["\uFEFF" + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = `matrice_enveloppes_${selectedYear}.csv`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    return (
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg">Matrice Financière - Enveloppes {selectedYear}</h2>
          <button onClick={exportMatrixCSV} className="bg-green-600 text-white px-4 py-2 rounded font-semibold"><Download size={18} className="inline mr-2"/> Exporter CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border border-gray-300 text-left">Enveloppes</th>
                <th className="p-2 border border-gray-300 text-right">Plafond mensuel</th>
                {MONTHNAMES.map(m => (
                  <React.Fragment key={m}><th className="p-2 border">{m}</th><th className="p-2 border bg-gray-50">Cumul</th><th className="p-2 border">Indicateur</th></React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {envelopes.map(env => {
                const plafond = env.allocatedAmount / 12;
                return (
                  <tr key={env.id} className="hover:bg-blue-50">
                    <td className="p-2 border font-medium">{env.name}</td>
                    <td className="p-2 border text-right">{plafond.toFixed(0)}</td>
                    {Array(12).fill(0).map((_, m) => {
                      const spent = matrixData[env.id].monthly[m];
                      const cum = matrixData[env.id].cumulative[m];
                      const deltaCum = (plafond * (m + 1)) - cum;
                      return (
                        <React.Fragment key={m}>
                          <td className="p-2 border text-right">{spent === 0 ? '-' : spent.toFixed(0)}</td>
                          <td className="p-2 border text-right bg-gray-50">{cum === 0 ? '-' : cum.toFixed(0)}</td>
                          <td className={`p-2 border text-right font-bold ${deltaCum>=0?'text-green-600':'text-red-600'}`}>{deltaCum>0?'+':''}{deltaCum.toFixed(0)}</td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
              <tr className="bg-blue-600 text-white font-bold">
                <td className="p-2 border">Total Immeuble</td>
                <td className="p-2 border text-right">{allTotals.totalPlafond.toFixed(0)}</td>
                {Array(12).fill(0).map((_, m) => (
                  <React.Fragment key={m}>
                    <td className="p-2 border text-right">{allTotals.monthlySum[m].toFixed(0)}</td>
                    <td className="p-2 border text-right bg-blue-700">{allTotals.cumulativeSum[m].toFixed(0)}</td>
                    <td className="p-2 border text-right">-</td>
                  </React.Fragment>
                ))}
              </tr>

              <tr><td colSpan={38} className="p-2 bg-white border-0"></td></tr>
              
              <tr className="text-gray-600 italic bg-gray-50">
                <td className="p-2 border font-semibold">Budget Mensuel objectif</td>
                <td className="p-2 border text-right">-</td>
                {Array(12).fill(0).map((_, m) => (
                  <React.Fragment key={m}>
                    <td className="p-2 border text-right">{allTotals.totalPlafond.toFixed(0)}</td>
                    <td className="p-2 border text-right bg-gray-100">{(allTotals.totalPlafond * (m + 1)).toFixed(0)}</td>
                    <td className="p-2 border text-center">-</td>
                  </React.Fragment>
                ))}
              </tr>

              <tr className="text-gray-600 italic">
                <td className="p-2 border font-semibold">Delta Mensuel ( Rea VS Obj )</td>
                <td className="p-2 border text-right">-</td>
                {Array(12).fill(0).map((_, m) => {
                  const obj = allTotals.totalPlafond;
                  const cumObj = obj * (m + 1);
                  const real = allTotals.monthlySum[m];
                  const cumReal = allTotals.cumulativeSum[m];
                  const deltaPct = obj > 0 ? ((real - obj) / obj) * 100 : 0;
                  const cumDeltaPct = cumObj > 0 ? ((cumReal - cumObj) / cumObj) * 100 : 0;
                  return (
                    <React.Fragment key={m}>
                      <td className={`p-2 border text-right font-medium ${deltaPct > 0 ? 'text-red-500' : 'text-green-600'}`}>{deltaPct.toFixed(0)}%</td>
                      <td className={`p-2 border text-right bg-gray-50 font-medium ${cumDeltaPct > 0 ? 'text-red-500' : 'text-green-600'}`}>{cumDeltaPct.toFixed(0)}%</td>
                      <td className="p-2 border text-center">-</td>
                    </React.Fragment>
                  );
                })}
              </tr>

              <tr className="text-gray-600 italic bg-gray-50">
                <td className="p-2 border font-semibold">Suivi Mensuel ( Euros )</td>
                <td className="p-2 border text-right">-</td>
                {Array(12).fill(0).map((_, m) => (
                  <React.Fragment key={m}>
                    <td className="p-2 border text-right">{allTotals.totalPlafond.toFixed(0)}</td>
                    <td className="p-2 border text-right bg-gray-100">{(allTotals.totalPlafond * (m + 1)).toFixed(0)}</td>
                    <td className="p-2 border text-center">-</td>
                  </React.Fragment>
                ))}
              </tr>

              <tr className="text-gray-600 italic">
                <td className="p-2 border font-semibold">Share Mensuel ( % )</td>
                <td className="p-2 border text-right">-</td>
                {Array(12).fill(0).map((_, m) => {
                  const totalAnnuel = allTotals.cumulativeSum[11] || 1;
                  const sharePct = (allTotals.monthlySum[m] / totalAnnuel) * 100;
                  const cumSharePct = (allTotals.cumulativeSum[m] / totalAnnuel) * 100;
                  return (
                    <React.Fragment key={m}>
                      <td className="p-2 border text-right">{allTotals.monthlySum[m] > 0 ? sharePct.toFixed(1) + '%' : '-'}</td>
                      <td className="p-2 border text-right bg-gray-50">{allTotals.cumulativeSum[m] > 0 ? cumSharePct.toFixed(1) + '%' : '-'}</td>
                      <td className="p-2 border text-center">-</td>
                    </React.Fragment>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const ConfigurationTab = () => {
    const [editingEnv, setEditingEnv] = useState(null);
    const [tempEnvName, setTempEnvName] = useState('');
    const [tempEnvAmount, setTempEnvAmount] = useState('');
    const [tempSubs, setTempSubs] = useState([]);
    const [newSubInput, setNewSubInput] = useState('');
    const [newEnvName, setNewEnvName] = useState('');
    const [newEnvAmount, setNewEnvAmount] = useState('');
    const [envToDelete, setEnvToDelete] = useState(null); // Fix confirmation

    const startEdit = (env) => { setEditingEnv(env.id); setTempEnvName(env.name); setTempEnvAmount(env.allocatedAmount); setTempSubs([...(subCategoriesMap[env.id] || [])]); };
    
    const saveEdit = async () => {
      const newEnvs = envelopes.map(e => e.id === editingEnv ? { ...e, name: tempEnvName, allocatedAmount: parseFloat(tempEnvAmount) } : e);
      const newMap = { ...subCategoriesMap, [editingEnv]: tempSubs };
      await updateConfig(newEnvs, newMap);
      setEditingEnv(null);
    };
    
    const addSub = () => { if (newSubInput.trim() && !tempSubs.includes(newSubInput)) { setTempSubs([...tempSubs, newSubInput.trim()]); setNewSubInput(''); } };
    const removeSub = (sub) => { setTempSubs(tempSubs.filter(s => s !== sub)); };
    
    const executeDeleteEnv = async (id) => {
      const newEnvs = envelopes.filter(e => e.id !== id);
      const newMap = {...subCategoriesMap}; delete newMap[id];
      await updateConfig(newEnvs, newMap);
      setEnvToDelete(null);
    };

    const createEnv = async (e) => {
      e.preventDefault(); if(!newEnvName || !newEnvAmount) return;
      const id = Date.now().toString();
      const newEnvs = [...envelopes, { id, name: newEnvName, allocatedAmount: parseFloat(newEnvAmount) }];
      const newMap = { ...subCategoriesMap, [id]: [] };
      await updateConfig(newEnvs, newMap);
      setNewEnvName(''); setNewEnvAmount('');
    };

    return (
      <div className="space-y-6">
        <form onSubmit={createEnv} className="bg-white p-6 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1"><label className="text-sm font-bold mb-1 block">Nouvelle Enveloppe</label><input className="border p-2 rounded w-full" value={newEnvName} onChange={(e) => setNewEnvName(e.target.value)} required /></div>
          <div className="flex-1"><label className="text-sm font-bold mb-1 block">Budget Annuel (€)</label><input className="border p-2 rounded w-full" type="number" value={newEnvAmount} onChange={(e) => setNewEnvAmount(e.target.value)} required /></div>
          <button className="bg-blue-600 text-white px-6 py-2 rounded font-bold h-10">Créer</button>
        </form>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {envelopes.map(env => (
            <div key={env.id} className="bg-white border rounded-xl p-5 shadow-sm relative">
              {editingEnv === env.id ? (
                <div className="space-y-4">
                  <input className="border p-2 rounded w-full font-bold" value={tempEnvName} onChange={(e)=>setTempEnvName(e.target.value)} />
                  <input className="border p-2 rounded w-full" type="number" value={tempEnvAmount} onChange={(e)=>setTempEnvAmount(e.target.value)} />
                  <div className="bg-gray-50 p-2 rounded border">
                    <p className="text-xs font-semibold mb-2">Sous-catégories :</p>
                    <div className="flex flex-wrap gap-2 mb-2">{tempSubs.map(s => (<span key={s} className="bg-white border text-xs px-2 py-1 rounded flex items-center gap-1">{s} <button onClick={()=>removeSub(s)} className="text-red-500"><X size={12}/></button></span>))}</div>
                    <div className="flex gap-2"><input className="border p-1 text-xs rounded flex-1" value={newSubInput} onChange={(e)=>setNewSubInput(e.target.value)} /><button type="button" onClick={addSub} className="bg-blue-600 text-white text-xs px-2 rounded">Ajouter</button></div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4"><button onClick={()=>setEditingEnv(null)} className="px-3 py-1 bg-gray-200 rounded text-sm">Annuler</button><button onClick={saveEdit} className="px-3 py-1 bg-green-600 text-white rounded text-sm font-bold">Enregistrer</button></div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg pr-8">{env.name}</h3>
                    {envToDelete === env.id ? (
                      <div className="flex gap-1 absolute top-4 right-4 bg-red-50 border border-red-200 p-1 rounded">
                        <span className="text-[10px] text-red-600 font-bold self-center px-1">Confirmer?</span>
                        <button onClick={()=>executeDeleteEnv(env.id)} className="bg-red-600 text-white p-1 rounded hover:bg-red-700"><Trash2 size={14}/></button>
                        <button onClick={()=>setEnvToDelete(null)} className="bg-white text-gray-700 p-1 border rounded hover:bg-gray-100"><X size={14}/></button>
                      </div>
                    ) : (
                      <div className="flex gap-2 absolute top-4 right-4">
                        <button onClick={()=>startEdit(env)} className="text-blue-600 hover:text-blue-800"><Edit2 size={16}/></button>
                        <button onClick={()=>setEnvToDelete(env.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16}/></button>
                      </div>
                    )}
                  </div>
                  <p className="text-blue-600 font-bold mb-4">{formatCurrency(env.allocatedAmount)} <span className="text-xs text-gray-400 font-normal">/ an</span></p>
                  <div className="flex flex-wrap gap-1">{subCategoriesMap[env.id]?.map(s => (<span key={s} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded border">{s}</span>))}</div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const AdministrationTab = () => {
    if (currentUser?.role !== 'Administrateur') return <p>Accès refusé.</p>;
    const [userToDelete, setUserToDelete] = useState(null);
    const [requestToReject, setRequestToReject] = useState(null);

    const handleAccept = async (user) => {
      const newPending = usersConfig.pending.filter(u => u.email !== user.email);
      const newUsers = [...(usersConfig.users || []), { ...user, role: 'Éditeur' }];
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'users_auth'), { pending: newPending, users: newUsers });
    };

    const executeReject = async (email) => {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'users_auth'), { pending: usersConfig.pending.filter(u => u.email !== email) });
      setRequestToReject(null);
    };

    const executeDeleteUser = async (email) => {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'users_auth'), { users: usersConfig.users.filter(u => u.email !== email) });
      setUserToDelete(null);
    };

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h2 className="font-bold text-lg mb-4 text-orange-600">Demandes en attente ({usersConfig.pending?.length || 0})</h2>
          <div className="space-y-3">
            {usersConfig.pending?.map((u, i) => (
              <div key={i} className="flex items-center justify-between bg-orange-50 p-4 rounded-lg border">
                <div><p className="font-bold">{u.name}</p><p className="text-sm">{u.email}</p></div>
                <div className="flex gap-2">
                  {requestToReject === u.email ? (
                    <><button onClick={() => setRequestToReject(null)} className="px-3 py-1.5 text-sm bg-gray-200 rounded font-semibold">Annuler</button><button onClick={() => executeReject(u.email)} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded font-bold">Confirmer refus</button></>
                  ) : (
                    <><button onClick={() => setRequestToReject(u.email)} className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded font-semibold bg-white">Refuser</button><button onClick={() => handleAccept(u)} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded font-bold">Accepter</button></>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h2 className="font-bold text-lg mb-4 text-blue-900">Utilisateurs autorisés</h2>
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100"><tr><th className="p-3">Nom</th><th className="p-3">Email</th><th className="p-3">Rôle</th><th className="p-3">Actions</th></tr></thead>
            <tbody>
              {allowedUsers.map(u => (<tr key={u.email} className="border-b bg-gray-50"><td className="p-3 font-semibold">{u.name}</td><td className="p-3">{u.email}</td><td className="p-3 font-bold text-blue-800">{u.role}</td><td className="p-3 italic text-gray-400">Système</td></tr>))}
              {usersConfig.users?.map((u, i) => (<tr key={i} className="border-b hover:bg-gray-50"><td className="p-3 font-semibold">{u.name}</td><td className="p-3">{u.email}</td><td className="p-3 font-bold text-green-800">{u.role}</td><td className="p-3">{userToDelete === u.email ? (<div className="flex gap-2"><span className="text-xs text-red-600 font-bold">Confirmer?</span><button onClick={() => executeDeleteUser(u.email)} className="bg-red-600 text-white p-1 rounded"><Trash2 size={16} /></button><button onClick={() => setUserToDelete(null)} className="bg-gray-200 p-1 rounded"><X size={16} /></button></div>) : (<button onClick={() => setUserToDelete(u.email)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded"><Trash2 size={16} /></button>)}</td></tr>))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full border-t-8 border-t-blue-600">
          <div className="text-center mb-8"><User size={48} className="text-blue-600 mx-auto mb-4" /><h1 className="text-2xl font-extrabold text-blue-900">Doccity Budget</h1></div>
          {!isRegistering ? (
            <form onSubmit={(e) => { e.preventDefault(); const user = [...allowedUsers, ...(usersConfig.users || [])].find(u => u.email.toLowerCase() === loginEmail.toLowerCase().trim() && u.password === loginPassword); if (user) { setCurrentUser(user); setLoginError(false); } else setLoginError(true); }} className="space-y-4">
              <input type="email" placeholder="Email" className="w-full p-3 border rounded-xl bg-gray-50" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required autoFocus />
              <input type="password" placeholder="Mot de passe" className="w-full p-3 border rounded-xl bg-gray-50" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
              {loginError && <p className="text-red-500 text-xs text-center font-bold">Identifiants incorrects</p>}
              <button className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 shadow-md">Se connecter</button>
              <button type="button" onClick={() => setIsRegistering(true)} className="w-full text-sm font-semibold text-blue-600 hover:underline mt-4">Demander un accès</button>
            </form>
          ) : (
            <div className="space-y-4">
              {regSuccess ? (
                <div className="bg-green-50 text-green-700 p-4 rounded-xl text-center text-sm font-medium">Demande envoyée à l'administrateur ! <button onClick={() => setIsRegistering(false)} className="mt-4 w-full bg-white border border-green-300 py-2 rounded-lg font-bold">Retour</button></div>
              ) : (
                <form onSubmit={async (e) => { e.preventDefault(); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'users_auth'), { pending: [...(usersConfig.pending || []), { name: regName, email: regEmail.toLowerCase().trim(), password: regPassword, requestDate: new Date().toLocaleDateString('fr-FR') }] }); setRegSuccess(true); window.location.href = `mailto:finance@doc-city.fr?subject=Nouvel Acces Doccity Budget&body=Demande de ${regName}`; }} className="space-y-4">
                  <input type="text" placeholder="Nom" className="w-full p-3 border rounded-xl bg-gray-50" value={regName} onChange={(e) => setRegName(e.target.value)} required />
                  <input type="email" placeholder="Email" className="w-full p-3 border rounded-xl bg-gray-50" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
                  <input type="password" placeholder="Mot de passe" className="w-full p-3 border rounded-xl bg-gray-50" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required />
                  <div className="flex gap-2"><button type="button" onClick={() => setIsRegistering(false)} className="flex-1 bg-gray-200 font-bold py-3 rounded-xl">Annuler</button><button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl">Envoyer</button></div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isDBReady) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-blue-600"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-gray-800">
      <div className="max-w-[1400px] mx-auto">
        <header className="mb-8 flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div><h1 className="text-3xl font-extrabold text-blue-900 tracking-tight">Doccity Budget <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold ml-2">Cloud Actif</span></h1><p className="text-gray-500 font-medium">Tableau de bord de gestion financière partagé</p></div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100">
              <Calendar size={18} className="text-blue-600" />
              <select 
                className="bg-transparent font-bold text-blue-900 outline-none cursor-pointer"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="bg-gray-50 px-5 py-3 rounded-xl border flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-bold">{currentUser.name}</p>
                <p className="text-xs text-blue-600 font-semibold">{currentUser.role}</p>
              </div>
              <button onClick={() => setCurrentUser(null)} className="text-gray-500 hover:text-red-600 p-2"><LogOut size={20} /></button>
            </div>
          </div>
        </header>

        <nav className="flex gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: 'saisie', label: 'Saisie Dépenses', icon: <Plus size={18} /> },
            { id: 'suivi', label: 'Suivi Mensuel', icon: <Search size={18} /> },
            { id: 'enveloppes', label: 'Enveloppes & Plafonds', icon: <Download size={18} /> },
            { id: 'configuration', label: 'Configuration', icon: <Settings size={18} /> },
            ...(currentUser.role === 'Administrateur' ? [{ id: 'admin', label: 'Administration', icon: <User size={18} /> }] : [])
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 whitespace-nowrap px-6 py-3.5 rounded-xl font-bold transition-all shadow-sm ${activeTab === t.id ? 'bg-blue-700 text-white shadow-md' : 'bg-white text-gray-600 border hover:bg-blue-50'}`}>{t.icon} {t.label}</button>
          ))}
        </nav>

        <main className="transition-all duration-300">
          {activeTab === 'saisie' && <SaisieTab />}
          {activeTab === 'suivi' && <SuiviTab />}
          {activeTab === 'enveloppes' && <EnveloppesTab />}
          {activeTab === 'configuration' && <ConfigurationTab />}
          {activeTab === 'admin' && currentUser.role === 'Administrateur' && <AdministrationTab />}
        </main>
      </div>
    </div>
  );
}