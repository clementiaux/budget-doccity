import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, Edit2, Trash2, Plus, Settings, Save, X, Search, 
  LogOut, User, Calendar, CheckCircle, Upload, AlertTriangle, 
  FileText, RefreshCw, Check, ArrowRight
} from 'lucide-react';
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

const formatCurrency = (val) => `${Number(val || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
const MONTHNAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const SHORTMONTHS = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUI', 'JUIL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];
const BASE_YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

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

function parseCSVLine(line, separator) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
}

function cleanAndNormalizeDate(raw) {
  if (!raw) return '';
  let str = String(raw).replace(/(^"|"$)/g, '').trim();
  str = str.split(' ')[0].split('T')[0];

  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    let day = dmyMatch[1].padStart(2, '0');
    let month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }

  const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return str;
}

function parseAmountValue(raw) {
  if (raw === undefined || raw === null) return 0;
  let s = String(raw).replace(/[\s\u00A0€$]/g, '').trim();
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  s = s.replace(/[^\d.-]/g, '');
  const val = parseFloat(s);
  return isNaN(val) ? 0 : val;
}

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

  // États pour conserver l'import CSV
  const [importPreviewData, setImportPreviewData] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [importDuplicatesCount, setImportDuplicatesCount] = useState(0);
  const [importResult, setImportResult] = useState(null);

  const allowedUsers = [
    { email: 'finance@doc-city.fr', password: 'Doccityviton2026', name: 'Direction', role: 'Administrateur' },
    { email: 'compta@doccity.fr', password: 'doccity2026', name: 'Service Comptabilité', role: 'Éditeur' }
  ];

  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } 
      catch (error) { console.error("Erreur d'authentification Firebase", error); }
    };
    initAuth();
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

  const allYears = useMemo(() => {
    const yearsSet = new Set(BASE_YEARS);
    expenses.forEach(ex => {
      if (ex.date) {
        const y = parseInt(ex.date.split('-')[0], 10);
        if (!isNaN(y) && y > 2000 && y < 2100) yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [expenses]);

  const expensesPerYear = useMemo(() => {
    const counts = {};
    expenses.forEach(ex => {
      const y = ex.date ? parseInt(ex.date.split('-')[0], 10) : null;
      if (y) counts[y] = (counts[y] || 0) + 1;
    });
    return counts;
  }, [expenses]);

  const SaisieTab = () => {
    const [desc, setDesc] = useState('');
    const [invoiceNum, setInvoiceNum] = useState('');
    const [date, setDate] = useState('');
    const [cat, setCat] = useState(envelopes.length > 0 ? envelopes[0].id : '');
    const [sub, setSub] = useState(cat && subCategoriesMap[cat] ? subCategoriesMap[cat][0] : '');
    const [amount, setAmount] = useState('');
    const [isProvisional, setIsProvisional] = useState(false);
    const [selectedRecurringMonths, setSelectedRecurringMonths] = useState([]);
    const [editId, setEditId] = useState(null);
    const [expenseToDelete, setExpenseToDelete] = useState(null);
    
    // Nouvel état pour la sélection multiple
    const [selectedExpenses, setSelectedExpenses] = useState([]);
    const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

    // Réinitialiser la sélection si on change d'année
    useEffect(() => {
      setSelectedExpenses([]);
      setShowBatchDeleteConfirm(false);
    }, [selectedYear]);
    
    // Filtres
    const [searchDesc, setSearchDesc] = useState('');
    const [searchInvoice, setSearchInvoice] = useState('');
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
        date: String(date), 
        description: String(desc), 
        invoiceNum: String(invoiceNum || ''),
        amount: parseFloat(amount), 
        categoryId: String(cat), 
        subCategory: String(sub || ''),
        isProvisional: Boolean(isProvisional)
      };
      
      if (editId) {
        payload.updatedBy = currentUser.name;
        payload.updatedAt = new Date().toISOString();
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', editId), payload);
        setEditId(null);
      } else {
        payload.createdBy = currentUser.name;
        payload.createdAt = new Date().toISOString();
        
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), payload);

        if (selectedRecurringMonths.length > 0) {
            const [yyyy, mm, dd] = payload.date.split('-');
            const baseMonth = parseInt(mm, 10) - 1;
            const safeDd = parseInt(dd, 10) > 28 ? '28' : dd;

            for (const m of selectedRecurringMonths) {
                if (m === baseMonth) continue;
                const newDate = `${yyyy}-${String(m + 1).padStart(2, '0')}-${safeDd}`;
                const recurringPayload = { ...payload, date: newDate };
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), recurringPayload);
            }
        }
      }
      setDesc(''); setInvoiceNum(''); setAmount(''); setDate(''); setIsProvisional(false); setSelectedRecurringMonths([]);
    };

    const handleEditClick = (expense) => {
      setDesc(expense.description || ''); 
      setInvoiceNum(expense.invoiceNum || '');
      setDate(expense.date || ''); 
      setCat(expense.categoryId || ''); 
      setSub(expense.subCategory || ''); 
      setAmount(expense.amount || ''); 
      setIsProvisional(expense.isProvisional || false);
      setEditId(expense.id);
      setSelectedRecurringMonths([]); 
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const executeDeleteExpense = async (id) => {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', id));
      setExpenseToDelete(null);
    };

    const handleSelectAll = (e) => {
      if (e.target.checked) {
        setSelectedExpenses(filtered.map(ex => ex.id));
      } else {
        setSelectedExpenses([]);
      }
    };

    const handleSelectOne = (id) => {
      setSelectedExpenses(prev => 
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    };

    const executeBatchDelete = async () => {
      for (const id of selectedExpenses) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', id));
      }
      setSelectedExpenses([]);
      setShowBatchDeleteConfirm(false);
    };

    let filtered = expenses.filter(ex => {
      const expYear = ex.date ? parseInt(ex.date.split('-')[0], 10) : 0;
      if (expYear !== selectedYear) return false;
      if (searchDesc && !(ex.description || '').toLowerCase().includes(searchDesc.toLowerCase())) return false;
      if (searchInvoice && !(ex.invoiceNum || '').toLowerCase().includes(searchInvoice.toLowerCase())) return false;
      if (filterCat && ex.categoryId !== filterCat) return false;
      if (filterSub && ex.subCategory !== filterSub) return false;
      if (minAmount && ex.amount < parseFloat(minAmount)) return false;
      if (maxAmount && ex.amount > parseFloat(maxAmount)) return false;
      return true;
    });

    filtered.sort((a, b) => {
      let valA = a[sortField]; let valB = b[sortField];
      if (sortField === 'date') { 
        valA = new Date(valA || '1970-01-01').getTime(); 
        valB = new Date(valB || '1970-01-01').getTime(); 
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const otherYearsWithExpenses = Object.keys(expensesPerYear)
      .map(Number)
      .filter(y => y !== selectedYear && expensesPerYear[y] > 0);

    const baseMonthIndex = date ? parseInt(date.split('-')[1], 10) - 1 : -1;

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Bandeau d'information si des factures existent sur d'autres années */}
        {otherYearsWithExpenses.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3 text-amber-900">
              <Calendar className="text-amber-600 shrink-0" size={22} />
              <div>
                <p className="font-bold text-sm">
                  Vous consultez l'année <span className="underline font-black">{selectedYear}</span> ({filtered.length} dépense(s)).
                </p>
                <p className="text-xs text-amber-700">
                  Des factures sont enregistrées sur d'autres années : {otherYearsWithExpenses.map(y => `${y} (${expensesPerYear[y]})`).join(', ')}.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-semibold text-amber-800">Bascule rapide :</span>
              {otherYearsWithExpenses.map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className="px-2.5 py-1 text-xs bg-white text-amber-900 font-bold border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors shadow-xs"
                >
                  Voir {y} ({expensesPerYear[y]})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Formulaire de Saisie */}
        <form onSubmit={handleAddOrEdit} className={`p-6 rounded-xl border shadow-sm grid grid-cols-1 md:grid-cols-12 gap-4 ${editId ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
          <div className="col-span-full mb-2 font-bold text-gray-700 flex justify-between">
            {editId ? 'Modifier la dépense' : `Saisir une nouvelle dépense (${selectedYear})`}
            {editId && <button type="button" onClick={() => {setEditId(null); setDesc(''); setInvoiceNum(''); setAmount(''); setDate(''); setIsProvisional(false); setSelectedRecurringMonths([]);}} className="text-red-500 text-sm hover:underline">Annuler la modification</button>}
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Date</label>
            <input className="border p-2 rounded w-full" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 mb-1">N° Facture (Optionnel)</label>
            <input className="border p-2 rounded w-full" placeholder="Ex: FAC-2025-01" type="text" value={invoiceNum} onChange={(e) => setInvoiceNum(e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Bénéficiaire / Description</label>
            <input className="border p-2 rounded w-full" placeholder="Fournisseur ou libellé" value={desc} onChange={(e) => setDesc(e.target.value)} required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Montant (€)</label>
            <input className="border p-2 rounded w-full" placeholder="0.00" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Catégorie</label>
            <select className="border p-2 rounded w-full" value={cat} onChange={(e) => { setCat(e.target.value); setSub(subCategoriesMap[e.target.value]?.[0] || ''); }}>
              {envelopes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Sous-catégorie</label>
            <select className="border p-2 rounded w-full" value={sub} onChange={(e) => setSub(e.target.value)}>
              {subCategoriesMap[cat]?.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          
          <div className="md:col-span-3 flex items-end">
            <label className="flex items-center justify-center gap-2 border p-2.5 rounded cursor-pointer transition-colors bg-white hover:bg-gray-50 text-gray-700 w-full">
              <input type="checkbox" checked={isProvisional} onChange={(e) => setIsProvisional(e.target.checked)} className="w-4 h-4 cursor-pointer accent-blue-600" />
              <span className="text-sm font-semibold select-none">Dépense Prévisionnelle</span>
            </label>
          </div>

          <div className="md:col-span-6 flex items-end">
            <button className={`${editId ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white p-2.5 rounded font-bold flex justify-center items-center gap-2 w-full shadow-sm transition-colors`}>
              {editId ? <Save size={18} /> : <Plus size={18} />}
              {editId ? 'Mettre à jour la saisie' : 'Ajouter la Dépense'}
            </button>
          </div>

          {!editId && (
            <div className="col-span-full mt-2 p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
              <p className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">Dupliquer cette saisie sur d'autres mois ? <span className="font-normal text-xs italic">(Optionnel)</span></p>
              <div className="flex flex-wrap gap-2">
                {SHORTMONTHS.map((m, i) => {
                  const isBaseMonth = i === baseMonthIndex;
                  return (
                    <button type="button" key={i} disabled={isBaseMonth} onClick={() => setSelectedRecurringMonths(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${isBaseMonth ? 'bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed' : selectedRecurringMonths.includes(i) ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-100'}`}>
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </form>

        {/* Historique et Filtres */}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex flex-col md:flex-row justify-between mb-4 gap-4 items-center">
            <div>
              <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                Historique des dépenses ({selectedYear})
                <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                  {filtered.length} ligne(s)
                </span>
              </h2>
              <p className="text-xs text-gray-500">Total affiché : {formatCurrency(filtered.reduce((sum, e) => sum + (e.amount || 0), 0))}</p>
            </div>
            
            {(searchDesc || searchInvoice || filterCat || minAmount || maxAmount) && (
              <button 
                onClick={() => { setSearchDesc(''); setSearchInvoice(''); setFilterCat(''); setFilterSub(''); setMinAmount(''); setMaxAmount(''); }}
                className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
              >
                <RefreshCw size={14} /> Réinitialiser les filtres
              </button>
            )}
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 border">
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 font-semibold mb-1 block">Bénéficiaire / Desc.</label>
              <div className="relative"><Search className="absolute left-2 top-2.5 text-gray-400" size={14} /><input type="text" placeholder="Rechercher..." className="border p-2 pl-7 rounded w-full bg-white text-sm" value={searchDesc} onChange={(e) => setSearchDesc(e.target.value)} /></div>
            </div>
            <div className="md:col-span-1">
              <label className="text-xs text-gray-500 font-semibold mb-1 block">N° Facture</label>
              <div className="relative"><FileText className="absolute left-2 top-2.5 text-gray-400" size={14} /><input type="text" placeholder="N°..." className="border p-2 pl-7 rounded w-full bg-white text-sm" value={searchInvoice} onChange={(e) => setSearchInvoice(e.target.value)} /></div>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 font-semibold mb-1 block">Catégorie</label>
              <select className="border p-2 rounded w-full bg-white text-sm" value={filterCat} onChange={(e) => {setFilterCat(e.target.value); setFilterSub('');}}><option value="">Toutes</option>{envelopes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
            </div>
            <div className="md:col-span-1">
              <label className="text-xs text-gray-500 font-semibold mb-1 block">Montant Max (€)</label>
              <input type="number" placeholder="Max..." className="border p-2 rounded w-full bg-white text-sm" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
            </div>
          </div>

          {selectedExpenses.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex flex-col md:flex-row items-center justify-between gap-3 animate-fade-in shadow-sm">
              <span className="text-sm font-bold text-red-800 flex items-center gap-2">
                <Trash2 size={18} /> {selectedExpenses.length} dépense(s) sélectionnée(s)
              </span>
              {showBatchDeleteConfirm ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-red-600 mr-2">Êtes-vous sûr de vouloir tout supprimer ?</span>
                  <button onClick={executeBatchDelete} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-md hover:bg-red-700 transition-colors shadow-sm">Oui, supprimer définitivement</button>
                  <button onClick={() => setShowBatchDeleteConfirm(false)} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-800 text-xs font-bold rounded-md hover:bg-gray-50 transition-colors shadow-sm">Annuler</button>
                </div>
              ) : (
                <button onClick={() => setShowBatchDeleteConfirm(true)} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-red-300 text-red-700 hover:bg-red-50 text-sm font-bold rounded-md transition-colors shadow-sm">
                  Supprimer la sélection
                </button>
              )}
            </div>
          )}

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="p-3 text-center w-10">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 cursor-pointer accent-blue-600 rounded"
                      checked={filtered.length > 0 && selectedExpenses.length === filtered.length}
                      onChange={handleSelectAll}
                      title="Tout sélectionner"
                    />
                  </th>
                  <th className="p-3 text-left cursor-pointer hover:bg-gray-200" onClick={() => { setSortField('date'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>Date</th>
                  <th className="p-3 text-left">N° Facture</th>
                  <th className="p-3 text-left">Bénéficiaire</th>
                  <th className="p-3 text-left">Catégorie & Sous-catégorie</th>
                  <th className="p-3 text-left">Auteur / Source</th>
                  <th className="p-3 text-right cursor-pointer hover:bg-gray-200" onClick={() => { setSortField('amount'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>Montant HT</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(ex => (
                  <tr key={ex.id} className={`transition-colors ${selectedExpenses.includes(ex.id) ? 'bg-blue-50/60' : ex.isProvisional ? 'bg-orange-50/50 hover:bg-orange-100/50' : 'bg-white hover:bg-gray-50'}`}>
                    <td className="p-3 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 cursor-pointer accent-blue-600 rounded"
                        checked={selectedExpenses.includes(ex.id)}
                        onChange={() => handleSelectOne(ex.id)}
                      />
                    </td>
                    <td className="p-3 whitespace-nowrap font-medium text-gray-700">{ex.date ? new Date(ex.date).toLocaleDateString('fr-FR') : '-'}</td>
                    <td className="p-3 font-mono text-xs text-blue-700 font-semibold">{ex.invoiceNum || '-'}</td>
                    <td className="p-3 text-gray-800 font-medium">
                      {ex.description}
                      {ex.isProvisional && <span className="ml-2 text-[10px] bg-orange-600 text-white px-2 py-0.5 rounded-full uppercase font-bold tracking-wider inline-block">Prévisionnel</span>}
                    </td>
                    <td className="p-3">
                      <span className={`font-bold ${ex.isProvisional ? 'text-orange-700' : 'text-gray-900'}`}>{ex.categoryId}</span> <br/> 
                      <span className="text-gray-500 text-xs">{ex.subCategory || '-'}</span>
                    </td>
                    <td className="p-3 text-xs text-gray-500">
                      {ex.updatedBy ? <span>Modifié par <br/><b className="text-gray-700">{ex.updatedBy}</b></span> : ex.createdBy ? <span><b className="text-gray-700">{ex.createdBy}</b></span> : <span>-</span>}
                    </td>
                    <td className={`p-3 text-right font-bold ${ex.isProvisional ? 'text-orange-700' : 'text-gray-900'}`}>{formatCurrency(ex.amount)}</td>
                    <td className="p-3 text-center">
                      {expenseToDelete === ex.id ? (
                        <div className="flex justify-center items-center gap-1">
                          <span className="text-[10px] text-red-600 font-bold">Supprimer?</span>
                          <button onClick={() => executeDeleteExpense(ex.id)} className="bg-red-600 text-white p-1 rounded hover:bg-red-700"><Trash2 size={16} /></button>
                          <button onClick={() => setExpenseToDelete(null)} className="bg-gray-200 p-1 rounded hover:bg-gray-300"><X size={16} /></button>
                        </div>
                      ) : (
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleEditClick(ex)} className="text-blue-600 p-1.5 hover:bg-blue-100 rounded transition-colors" title="Modifier"><Edit2 size={16} /></button>
                          <button onClick={() => setExpenseToDelete(ex.id)} className="text-gray-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded transition-colors" title="Supprimer"><Trash2 size={16} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-gray-500 italic bg-gray-50">
                      Aucune dépense trouvée pour {selectedYear}.
                      {expenses.length > 0 && otherYearsWithExpenses.length > 0 && (
                        <div className="mt-2 text-sm not-italic font-semibold text-blue-600">
                          Astuce : Changez l'année en haut de la page pour voir les factures d'autres exercices ({otherYearsWithExpenses.join(', ')}).
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const ImportTab = () => {
    const [isImporting, setIsImporting] = useState(false);
    const [batchCategory, setBatchCategory] = useState('');
    const [batchSubCategory, setBatchSubCategory] = useState('');
    const [importError, setImportError] = useState('');

    const handleFileUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      setImportFileName(file.name);
      setImportResult(null);
      setImportDuplicatesCount(0);
      setImportError('');
      
      const reader = new FileReader();
      reader.onload = (event) => {
        let text = String(event.target.result || '');
        if (text.charCodeAt(0) === 0xFEFF) text = text.substr(1);
        
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) return; 

        // Détection de la ligne d'en-tête
        let headerLineIdx = 0;
        for (let i = 0; i < Math.min(lines.length, 5); i++) {
          const l = lines[i].toLowerCase();
          if (l.includes('facture') || l.includes('date') || l.includes('montant') || l.includes('fournisseur') || l.includes('invoice') || l.includes('supplier')) {
            headerLineIdx = i;
            break;
          }
        }

        const headerLine = lines[headerLineIdx];
        const separator = headerLine.includes(';') ? ';' : (headerLine.includes('\t') ? '\t' : ',');
        const headers = parseCSVLine(headerLine.toLowerCase(), separator).map(h => h.replace(/(^"|"$)/g, '').trim());
        
        // Date
        let dateIdx = headers.findIndex(h => 
          h.includes('date de facturation') || 
          h.includes('date facture') || 
          h.includes('date de la facture') ||
          h.includes('date d\'émission') ||
          h.includes('date d’émission') ||
          h.includes('invoice date') ||
          h.includes('bill date')
        );
        if (dateIdx === -1) {
          dateIdx = headers.findIndex(h => h.includes('date') && !h.includes('échéance') && !h.includes('echeance') && !h.includes('paiement') && !h.includes('due'));
        }
        if (dateIdx === -1) dateIdx = headers.findIndex(h => h.includes('date'));
        
        // Numéro de facture
        let factIdx = headers.findIndex(h => 
          h.includes('numéro de facture') || 
          h.includes('numero de facture') || 
          h.includes('n° de facture') ||
          h.includes('n° facture') ||
          h.includes('num facture') ||
          h.includes('invoice number') ||
          h.includes('bill number')
        );
        if (factIdx === -1) factIdx = headers.findIndex(h => (h.includes('facture') || h.includes('invoice')) && !h.includes('date') && !h.includes('montant'));
        if (factIdx === -1) factIdx = headers.findIndex(h => h.includes('référence') || h.includes('reference') || h.includes('n°'));
        
        // Bénéficiaire / Fournisseur
        let benefIdx = headers.findIndex(h => 
          h.includes('fournisseur') || 
          h.includes('nom du fournisseur') ||
          h.includes('bénéficiaire') || 
          h.includes('beneficiaire') || 
          h.includes('tiers') || 
          h.includes('supplier') || 
          h.includes('vendor')
        );
        if (benefIdx === -1) benefIdx = headers.findIndex(h => h.includes('nom') || h.includes('name'));
        
        // Montant HT
        let montantIdx = headers.findIndex(h => 
          h.includes('montant ht') || 
          h.includes('total ht') || 
          h.includes('net ht') || 
          h.includes('excl. tax') || 
          h.includes('subtotal')
        );
        if (montantIdx === -1) montantIdx = headers.findIndex(h => (h.includes('montant') || h.includes('total')) && !h.includes('ttc') && !h.includes('tva'));
        if (montantIdx === -1) montantIdx = headers.findIndex(h => h.includes('débit') || h.includes('debit'));

        // Fallbacks d'indices si fichier sans entêtes clairs
        if (dateIdx === -1) dateIdx = 2;
        if (benefIdx === -1) benefIdx = 0;
        if (factIdx === -1) factIdx = 1;
        if (montantIdx === -1) montantIdx = 3;

        let dupCount = 0;
        const parsedData = [];
        
        for (let i = headerLineIdx + 1; i < lines.length; i++) {
           let row = lines[i].trim();
           if (!row) continue;
           
           let cols = parseCSVLine(row, separator);
           
           let rawDate = cols[dateIdx] || '';
           let rawBenef = cols[benefIdx] || '';
           let rawFact = cols[factIdx] || '';
           let rawMontant = cols[montantIdx] || '0';
           
           let amount = parseAmountValue(rawMontant);
           let dateVal = cleanAndNormalizeDate(rawDate);

           // Détection des doublons déjà enregistrés
           let isDuplicate = false;
           if (rawFact && rawFact.trim() !== '') {
               const cleanFact = rawFact.trim().toLowerCase();
               isDuplicate = expenses.some(ex => (ex.invoiceNum || '').trim().toLowerCase() === cleanFact);
           }

           if (isDuplicate) {
               dupCount++;
               continue;
           }

           if (rawBenef || rawFact || rawDate) {
               parsedData.push({
                 id: `${i}_${Date.now()}`,
                 date: dateVal,
                 beneficiary: rawBenef,
                 invoiceNum: rawFact,
                 amount: amount,
                 categoryId: '',
                 subCategory: ''
               });
           }
        }
        setImportDuplicatesCount(dupCount);
        setImportPreviewData(parsedData);
      };
      reader.readAsText(file);
    };

    const applyBatchCategory = () => {
      if (!batchCategory) return;
      setImportPreviewData(prev => prev.map(r => ({
        ...r,
        categoryId: batchCategory,
        subCategory: batchSubCategory || (subCategoriesMap[batchCategory]?.[0] || '')
      })));
    };

    const updateRow = (id, field, value) => {
       setImportPreviewData(prev => prev.map(r => {
           if (r.id === id) {
               const updated = { ...r, [field]: value };
               if (field === 'categoryId') {
                   updated.subCategory = subCategoriesMap[value]?.[0] || '';
               }
               return updated;
           }
           return r;
       }));
    };

    const removeRow = (id) => {
        setImportPreviewData(prev => prev.filter(r => r.id !== id));
    };

    const processImport = async (rowsToProcess) => {
      setIsImporting(true);
      let successCount = 0;
      const detectedYears = new Set();
      
      for (const row of rowsToProcess) {
         try {
            const expYear = parseInt((row.date || '').split('-')[0], 10);
            if (expYear) detectedYears.add(expYear);

            const payload = {
               date: String(row.date),
               description: String(row.beneficiary || 'Fournisseur inconnu'),
               invoiceNum: String(row.invoiceNum || ''),
               amount: Number(row.amount),
               categoryId: String(row.categoryId),
               subCategory: String(row.subCategory),
               isProvisional: false,
               createdBy: `${currentUser.name} (Import CSV)`,
               createdAt: new Date().toISOString()
            };
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), payload);
            successCount++;
         } catch (e) {
            console.error("Erreur d'import :", e);
         }
      }

      const yearsArray = Array.from(detectedYears).sort();
      setImportResult({ 
        success: successCount, 
        total: rowsToProcess.length,
        years: yearsArray
      });

      setIsImporting(false);
      return successCount;
    };

    const executeImportAll = async () => {
      setImportError('');
      const rowsToImport = importPreviewData.filter(r => r.date && !isNaN(r.amount));
      
      // Blocage strict si une seule ligne est incomplète
      const hasMissingCategories = rowsToImport.some(r => !r.categoryId || !r.subCategory);
      if (hasMissingCategories) {
        setImportError("Action bloquée : Vous devez obligatoirement renseigner une Catégorie ET une Sous-catégorie pour CHAQUE facture avant de valider l'importation globale.");
        return;
      }

      await processImport(rowsToImport);
      setImportPreviewData([]);
      setImportFileName('');
      setImportDuplicatesCount(0);
    };

    const executeImportReady = async () => {
      setImportError('');
      // On sépare les lignes prêtes (vertes) et les incomplètes (rouges)
      const readyRows = importPreviewData.filter(r => r.date && !isNaN(r.amount) && r.categoryId && r.subCategory);
      const unreadyRows = importPreviewData.filter(r => !(r.date && !isNaN(r.amount) && r.categoryId && r.subCategory));
      
      if (readyRows.length === 0) {
        setImportError("Aucune ligne n'est prête pour l'importation.");
        return;
      }

      await processImport(readyRows);
      
      // On met à jour le tableau pour ne garder que les lignes rouges
      setImportPreviewData(unreadyRows);
      if (unreadyRows.length === 0) {
         setImportFileName('');
         setImportDuplicatesCount(0);
      }
    };

    const readyCount = importPreviewData.filter(r => r.categoryId && r.subCategory && r.date).length;

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
           <h2 className="font-bold text-lg mb-2 flex items-center gap-2"><Upload size={20} className="text-blue-600"/> Importer vos factures (CSV)</h2>
           <p className="text-sm text-gray-500 mb-4">
             Déposez votre export de factures. L'application extrait automatiquement la date, le fournisseur, le numéro de pièce et le montant HT.
           </p>

           <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 hover:bg-blue-50 transition-colors relative cursor-pointer group">
             <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="Sélectionner un fichier CSV" />
             <div className="flex flex-col items-center gap-3 group-hover:scale-105 transition-transform">
               <Upload size={40} className="text-gray-400 group-hover:text-blue-500" />
               <p className="font-semibold text-gray-700">Cliquez ou glissez-déposez votre fichier CSV ici</p>
               <p className="text-xs text-gray-500">Colonnes reconnues : Date de facturation, Numéro de facture, Fournisseur / Tiers, Montant HT.</p>
               {importFileName && <p className="text-sm font-bold text-blue-600 mt-2 flex items-center gap-2"><CheckCircle size={16}/> Fichier en attente : {importFileName}</p>}
             </div>
           </div>

           {importDuplicatesCount > 0 && (
             <div className="mt-4 p-4 bg-orange-50 border border-orange-200 text-orange-800 rounded-lg flex items-center gap-2 font-bold animate-fade-in text-sm">
               <AlertTriangle size={20} className="shrink-0 text-orange-600" />
               {importDuplicatesCount} facture(s) du fichier ont été automatiquement ignorées car leur N° de facture est déjà enregistré.
             </div>
           )}

           {importResult && (
             <div className="mt-4 p-5 bg-green-50 border border-green-200 text-green-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in">
               <div className="flex items-center gap-3">
                 <CheckCircle size={24} className="text-green-600 shrink-0" />
                 <div>
                   <p className="font-bold text-base">
                     {importResult.success} facture(s) importée(s) avec succès dans la base !
                   </p>
                   {importResult.years?.length > 0 && (
                     <p className="text-xs text-green-700 mt-0.5">
                       Exercice(s) concerné(s) : <b>{importResult.years.join(', ')}</b>.
                     </p>
                   )}
                 </div>
               </div>

               {importResult.years?.length > 0 && (
                 <div className="flex gap-2">
                   {importResult.years.map(y => (
                     <button
                       key={y}
                       onClick={() => { setSelectedYear(y); setActiveTab('saisie'); }}
                       className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                     >
                       Voir les dépenses {y} <ArrowRight size={14} />
                     </button>
                   ))}
                 </div>
               )}
             </div>
           )}
        </div>

        {importPreviewData.length > 0 && (
          <div className="bg-white p-6 rounded-xl border shadow-sm animate-fade-in space-y-4">
            {/* Outil d'assignation en masse */}
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="w-full md:w-auto">
                <span className="text-xs font-bold text-blue-900 block mb-1 uppercase tracking-wider">Gain de temps : Assigner à toutes les lignes</span>
                <p className="text-xs text-blue-700">Appliquez une enveloppe budgétaire à l'ensemble du tableau en un clic.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <select 
                  className="border p-2 rounded text-xs bg-white font-medium flex-1 md:flex-initial"
                  value={batchCategory}
                  onChange={(e) => {
                    setBatchCategory(e.target.value);
                    setBatchSubCategory(subCategoriesMap[e.target.value]?.[0] || '');
                  }}
                >
                  <option value="">-- Choisir Enveloppe --</option>
                  {envelopes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>

                <select 
                  className="border p-2 rounded text-xs bg-white flex-1 md:flex-initial"
                  value={batchSubCategory}
                  onChange={(e) => setBatchSubCategory(e.target.value)}
                  disabled={!batchCategory}
                >
                  {subCategoriesMap[batchCategory]?.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                <button 
                  onClick={applyBatchCategory}
                  disabled={!batchCategory}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Check size={14} /> Appliquer à tout
                </button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
               <div>
                 <h3 className="font-bold text-lg text-gray-800">
                   Vérification des factures ({importPreviewData.length} lignes)
                 </h3>
                 <p className={`text-xs font-bold ${readyCount === importPreviewData.length ? 'text-green-600' : 'text-orange-500'}`}>
                   {readyCount} / {importPreviewData.length} ligne(s) prêtes (Catégorie et Sous-catégorie obligatoires).
                 </p>
               </div>

               <div className="flex flex-wrap gap-2">
                 {/* Ce bouton n'apparaît que s'il y a des lignes prêtes, mais pas TOUTES */}
                 {readyCount > 0 && readyCount < importPreviewData.length && (
                   <button 
                     onClick={executeImportReady} 
                     disabled={isImporting} 
                     className={`px-4 py-2.5 rounded-lg font-bold text-white flex items-center gap-2 transition-all shadow-sm ${isImporting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md'}`}
                   >
                     Intégrer les {readyCount} ligne(s) prête(s)
                   </button>
                 )}
                 <button 
                   onClick={executeImportAll} 
                   disabled={isImporting} 
                   className={`px-6 py-2.5 rounded-lg font-bold text-white flex items-center gap-2 transition-all shadow-sm ${isImporting ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 hover:shadow-md'}`}
                 >
                   {isImporting ? 'Importation en cours...' : `Tout confirmer (${importPreviewData.length})`}
                 </button>
               </div>
            </div>

            {importError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center gap-3 font-bold animate-fade-in shadow-sm">
                <AlertTriangle size={24} className="shrink-0 text-red-600" />
                {importError}
              </div>
            )}

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto border rounded-lg shadow-inner">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 sticky top-0 z-10 shadow-xs">
                  <tr>
                    <th className="p-3 whitespace-nowrap border-b border-gray-200">Date facturation</th>
                    <th className="p-3 border-b border-gray-200">Fournisseur / Libellé</th>
                    <th className="p-3 border-b border-gray-200">N° Facture</th>
                    <th className="p-3 text-right whitespace-nowrap border-b border-gray-200">Montant HT</th>
                    <th className="p-3 border-b border-gray-200">Catégorie</th>
                    <th className="p-3 border-b border-gray-200">Sous-Catégorie</th>
                    <th className="p-3 text-center border-b border-gray-200">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {importPreviewData.map((row) => {
                    const isReady = Boolean(row.categoryId && row.subCategory);
                    return (
                    <tr key={row.id} className={`transition-colors ${isReady ? 'bg-green-50/50 hover:bg-green-100/50' : 'bg-white hover:bg-gray-50'}`}>
                      <td className="p-2">
                        <input type="date" className="border p-1.5 text-xs rounded w-full bg-white font-medium" value={row.date} onChange={(e) => updateRow(row.id, 'date', e.target.value)} />
                      </td>
                      <td className="p-2">
                         <input type="text" className="border p-1.5 text-xs rounded w-full bg-white font-medium" value={row.beneficiary} onChange={(e) => updateRow(row.id, 'beneficiary', e.target.value)} placeholder="Fournisseur" />
                      </td>
                      <td className="p-2">
                         <input type="text" className="border p-1.5 text-xs rounded w-full bg-white font-mono text-blue-700 font-semibold" value={row.invoiceNum} onChange={(e) => updateRow(row.id, 'invoiceNum', e.target.value)} placeholder="N° Pièce" />
                      </td>
                      <td className="p-2 text-right">
                         <div className="flex items-center justify-end gap-1">
                           <input type="number" step="0.01" className="border p-1.5 text-xs rounded w-28 text-right bg-white font-bold" value={row.amount} onChange={(e) => updateRow(row.id, 'amount', parseFloat(e.target.value))} /> €
                         </div>
                      </td>
                      <td className="p-2">
                        <select className={`border p-1.5 text-xs rounded w-full font-medium ${row.categoryId ? 'bg-white border-green-300 text-green-900' : 'bg-red-50 border-red-300 text-red-900'}`} value={row.categoryId} onChange={(e) => updateRow(row.id, 'categoryId', e.target.value)}>
                          <option value="">-- Choisir Catégorie --</option>
                          {envelopes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <select className={`border p-1.5 text-xs rounded w-full font-medium ${row.subCategory ? 'bg-white border-green-300 text-green-900' : 'bg-red-50 border-red-300 text-red-900'}`} value={row.subCategory} onChange={(e) => updateRow(row.id, 'subCategory', e.target.value)} disabled={!row.categoryId}>
                          <option value="">-- Choisir Sous-Catégorie --</option>
                          {subCategoriesMap[row.categoryId]?.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="p-2 text-center">
                         <button onClick={() => removeRow(row.id)} className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors" title="Retirer"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        )}
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

    const toggleAllMonths = () => {
      if (selectedMonths.length === 12) {
        setSelectedMonths([new Date().getMonth()]);
      } else {
        setSelectedMonths([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      }
    };

    const filteredExpenses = expenses.filter(ex => {
      const expYear = ex.date ? parseInt(ex.date.split('-')[0], 10) : 0;
      const expMonth = ex.date ? parseInt(ex.date.split('-')[1], 10) - 1 : -1;
      return expYear === selectedYear && selectedMonths.includes(expMonth);
    });
    
    const monthRatio = selectedMonths.length / 12;
    let totalBudget = 0; let totalSpent = 0;

    const categoryStats = envelopes.map(env => {
      const proratedBudget = env.allocatedAmount * monthRatio;
      const envExpenses = filteredExpenses.filter(ex => ex.categoryId === env.id);
      const spent = envExpenses.reduce((sum, ex) => sum + (ex.amount || 0), 0);
      
      const subCatTotals = {};
      envExpenses.forEach(ex => {
        const subName = ex.subCategory || 'Non classé';
        const key = `${subName}_${ex.isProvisional ? 'prev' : 'val'}`;
        if(!subCatTotals[key]) {
          subCatTotals[key] = { name: String(subName), isProvisional: !!ex.isProvisional, amount: 0 };
        }
        subCatTotals[key].amount += (ex.amount || 0);
      });

      totalBudget += proratedBudget; totalSpent += spent;
      return { ...env, proratedBudget, spent, remaining: proratedBudget - spent, subCatTotals };
    });

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h2 className="font-bold text-xl mb-4 flex items-center gap-2"><Calendar size={20} className="text-blue-600"/> Sélection des mois de {selectedYear}</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={toggleAllMonths} className={`px-4 py-2 rounded-full font-bold text-sm border transition-colors ${selectedMonths.length === 12 ? 'bg-blue-800 text-white border-blue-800 shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200'}`}>
              Tous
            </button>
            {SHORTMONTHS.map((m, i) => (
              <button key={i} onClick={() => toggleMonth(i)} className={`px-4 py-2 rounded-full font-semibold text-sm border transition-colors ${selectedMonths.includes(i) ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'}`}>
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
                  <div className="w-full bg-gray-100 rounded-full h-3 mb-2 overflow-hidden border border-gray-200">
                    <div className={`h-full transition-all ${stat.spent > stat.proratedBudget ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }}></div>
                  </div>
                  
                  {subCatsPresent && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 ml-2 border-l-2 border-gray-100 pl-4">
                      <div>
                        <h4 className="text-xs font-bold text-green-700 uppercase mb-2 border-b border-green-200 pb-1">Validé</h4>
                        <div className="flex flex-col gap-2">
                          {Object.values(stat.subCatTotals).filter(sub => !sub.isProvisional).sort((a,b)=>b.amount-a.amount).map((sub) => {
                              const subPct = stat.spent > 0 ? ((sub.amount / stat.spent) * 100).toFixed(1) : 0;
                              return (
                                <div key={`${sub.name}-val`} className="text-xs border px-3 py-2 rounded-md shadow-xs flex items-center justify-between bg-white border-gray-200 text-gray-700">
                                   <span className="uppercase font-semibold truncate pr-2">{sub.name}</span>
                                   <span className="font-bold whitespace-nowrap bg-gray-50 px-2 py-0.5 rounded border text-gray-900">
                                     {formatCurrency(sub.amount)} <span className="text-gray-400 font-normal ml-1">({subPct}%)</span>
                                   </span>
                                </div>
                              );
                          })}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-orange-600 uppercase mb-2 border-b border-orange-200 pb-1">Prévisionnel</h4>
                        <div className="flex flex-col gap-2">
                          {Object.values(stat.subCatTotals).filter(sub => sub.isProvisional).sort((a,b)=>b.amount-a.amount).map((sub) => {
                              const subPct = stat.spent > 0 ? ((sub.amount / stat.spent) * 100).toFixed(1) : 0;
                              return (
                                <div key={`${sub.name}-prev`} className="text-xs border px-3 py-2 rounded-md shadow-xs flex items-center justify-between bg-orange-50 border-orange-200 text-orange-800">
                                   <span className="uppercase font-semibold truncate pr-2">{sub.name}</span>
                                   <span className="font-bold whitespace-nowrap bg-white px-2 py-0.5 rounded border border-orange-200 text-orange-700">
                                     {formatCurrency(sub.amount)} <span className="text-orange-400 font-normal ml-1">({subPct}%)</span>
                                   </span>
                                </div>
                              );
                          })}
                        </div>
                      </div>
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
        expenses.filter(ex => {
          const expYear = ex.date ? parseInt(ex.date.split('-')[0], 10) : 0;
          return ex.categoryId === env.id && expYear === selectedYear;
        }).forEach(ex => { 
          const m = ex.date ? parseInt(ex.date.split('-')[1], 10) - 1 : -1;
          if (m >= 0 && m < 12) monthly[m] += (ex.amount || 0); 
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

    return (
      <div className="bg-white p-4 rounded-xl border shadow-sm animate-fade-in overflow-x-auto">
        <h2 className="font-bold text-lg mb-4">Matrice Financière - Enveloppes {selectedYear}</h2>
        <table className="w-full text-xs whitespace-nowrap border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border border-gray-300 text-left">Enveloppes</th>
              <th className="p-2 border border-gray-300 text-right">Plafond</th>
              {MONTHNAMES.map(m => (
                <React.Fragment key={m}><th className="p-2 border">{m}</th><th className="p-2 border bg-gray-50">Cumul</th><th className="p-2 border">Δ</th></React.Fragment>
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
              <td className="p-2 border">Total</td>
              <td className="p-2 border text-right">{allTotals.totalPlafond.toFixed(0)}</td>
              {Array(12).fill(0).map((_, m) => (
                <React.Fragment key={m}>
                  <td className="p-2 border text-right">{allTotals.monthlySum[m].toFixed(0)}</td>
                  <td className="p-2 border text-right bg-blue-700">{allTotals.cumulativeSum[m].toFixed(0)}</td>
                  <td className="p-2 border text-right">-</td>
                </React.Fragment>
              ))}
            </tr>
          </tbody>
        </table>
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

    const startEdit = (env) => { 
      setEditingEnv(env.id); 
      setTempEnvName(env.name); 
      setTempEnvAmount(env.allocatedAmount); 
      setTempSubs([...(subCategoriesMap[env.id] || [])]); 
      setNewSubInput('');
    };
    
    const saveEdit = async () => {
      const newEnvs = envelopes.map(e => e.id === editingEnv ? { ...e, name: tempEnvName, allocatedAmount: parseFloat(tempEnvAmount) } : e);
      const newMap = { ...subCategoriesMap, [editingEnv]: tempSubs };
      await updateConfig(newEnvs, newMap);
      setEditingEnv(null);
    };

    const addSub = () => { 
      if (newSubInput.trim() && !tempSubs.includes(newSubInput.trim())) { 
        setTempSubs([...tempSubs, newSubInput.trim()]); 
        setNewSubInput(''); 
      } 
    };

    const removeSub = (sub) => { 
      setTempSubs(tempSubs.filter(s => s !== sub)); 
    };
    
    return (
      <div className="space-y-6 animate-fade-in">
        <form onSubmit={async (e)=>{e.preventDefault(); if(!newEnvName || !newEnvAmount) return; const id = Date.now().toString(); const newEnvs = [...envelopes, { id, name: String(newEnvName), allocatedAmount: parseFloat(newEnvAmount) }]; const newMap = { ...subCategoriesMap, [id]: [] }; await updateConfig(newEnvs, newMap); setNewEnvName(''); setNewEnvAmount('');}} className="bg-white p-6 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1"><label className="text-sm font-bold mb-1 block">Nouvelle Enveloppe</label><input className="border p-2 rounded w-full" value={newEnvName} onChange={(e) => setNewEnvName(e.target.value)} required /></div>
          <div className="flex-1"><label className="text-sm font-bold mb-1 block">Budget Annuel (€)</label><input className="border p-2 rounded w-full" type="number" value={newEnvAmount} onChange={(e) => setNewEnvAmount(e.target.value)} required /></div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-bold h-10 transition-colors">Créer</button>
        </form>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {envelopes.map(env => (
            <div key={env.id} className="bg-white border rounded-xl p-5 shadow-sm relative">
              {editingEnv === env.id ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Nom de l'enveloppe</label>
                    <input className="border p-2 rounded w-full font-bold" value={tempEnvName} onChange={(e)=>setTempEnvName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Budget annuel (€)</label>
                    <input className="border p-2 rounded w-full" type="number" value={tempEnvAmount} onChange={(e)=>setTempEnvAmount(e.target.value)} />
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <p className="text-xs font-bold text-gray-700 mb-2">Sous-catégories :</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {tempSubs.map(s => (
                        <span key={s} className="bg-white border border-gray-300 text-gray-700 text-xs px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
                          {s} 
                          <button type="button" onClick={()=>removeSub(s)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-0.5 rounded transition-colors"><X size={12}/></button>
                        </span>
                      ))}
                      {tempSubs.length === 0 && <span className="text-xs text-gray-400 italic">Aucune sous-catégorie</span>}
                    </div>
                    <div className="flex gap-2">
                      <input className="border p-1.5 text-xs rounded flex-1 shadow-inner" placeholder="Nouvelle sous-catégorie..." value={newSubInput} onChange={(e)=>setNewSubInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }} />
                      <button type="button" onClick={addSub} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded font-bold transition-colors">Ajouter</button>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button type="button" onClick={()=>setEditingEnv(null)} className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded-md text-sm font-semibold transition-colors">Annuler</button>
                    <button type="button" onClick={saveEdit} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-bold transition-colors">Enregistrer</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-2"><h3 className="font-bold text-lg pr-8 text-gray-800">{env.name}</h3><button onClick={()=>startEdit(env)} className="text-blue-600 hover:text-blue-800 bg-blue-50 p-1.5 rounded transition-colors"><Edit2 size={16}/></button></div>
                  <p className="text-blue-600 font-bold mb-4">{formatCurrency(env.allocatedAmount)} <span className="text-xs text-gray-400 font-normal">/ an</span></p>
                  <div className="flex flex-wrap gap-1">{subCategoriesMap[env.id]?.map(s => (<span key={s} className="bg-gray-50 text-gray-600 text-xs px-2 py-1 rounded border border-gray-200">{s}</span>))}</div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const AdministrationTab = () => {
    if (currentUser?.role !== 'Administrateur') return <div className="p-6 bg-red-50 text-red-600 rounded-lg font-bold text-center">Accès refusé. Réservé à l'administrateur.</div>;
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h2 className="font-bold text-lg mb-4 text-orange-600">Demandes en attente ({usersConfig.pending?.length || 0})</h2>
          <div className="space-y-3">
            {usersConfig.pending?.map((u, i) => (
              <div key={i} className="flex items-center justify-between bg-orange-50 p-4 rounded-lg border border-orange-100">
                <div><p className="font-bold">{u.name}</p><p className="text-sm">{u.email}</p></div>
                <button onClick={async () => await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'users_auth'), { pending: usersConfig.pending.filter(x => x.email !== u.email), users: [...(usersConfig.users || []), { ...u, role: 'Éditeur' }] })} className="px-4 py-2 text-sm bg-green-600 text-white rounded font-bold hover:bg-green-700">Accepter l'accès</button>
              </div>
            ))}
            {(!usersConfig.pending || usersConfig.pending.length === 0) && <p className="text-gray-500 italic text-sm">Aucune demande en attente.</p>}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h2 className="font-bold text-lg mb-4 text-blue-900">Utilisateurs autorisés</h2>
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100"><tr><th className="p-3">Nom</th><th className="p-3">Email</th><th className="p-3">Rôle</th></tr></thead>
            <tbody>
              {allowedUsers.map(u => (<tr key={u.email} className="border-b bg-gray-50"><td className="p-3 font-semibold">{u.name}</td><td className="p-3">{u.email}</td><td className="p-3 font-bold text-blue-800">{u.role}</td></tr>))}
              {usersConfig.users?.map((u, i) => (<tr key={i} className="border-b hover:bg-gray-50"><td className="p-3 font-semibold">{u.name}</td><td className="p-3">{u.email}</td><td className="p-3 font-bold text-green-800">{u.role}</td></tr>))}
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
            <form onSubmit={(e) => { e.preventDefault(); const user = [...allowedUsers, ...(usersConfig.users || [])].find(u => String(u.email).toLowerCase() === String(loginEmail).toLowerCase().trim() && u.password === loginPassword); if (user) { setCurrentUser(user); setLoginError(false); } else setLoginError(true); }} className="space-y-4">
              <input type="email" placeholder="Email" className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:border-blue-500 focus:bg-white transition-all" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required autoFocus />
              <input type="password" placeholder="Mot de passe" className="w-full p-3 border rounded-xl bg-gray-50 outline-none focus:border-blue-500 focus:bg-white transition-all" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
              {loginError && <p className="text-red-500 text-xs text-center font-bold bg-red-50 p-2 rounded">Identifiants incorrects</p>}
              <button className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 shadow-md transition-all active:scale-95">Se connecter</button>
              <button type="button" onClick={() => setIsRegistering(true)} className="w-full text-sm font-semibold text-blue-600 hover:underline mt-4">Demander un accès</button>
            </form>
          ) : (
            <div className="space-y-4">
              {regSuccess ? (
                <div className="bg-green-50 text-green-700 p-4 rounded-xl text-center text-sm font-medium">Demande envoyée à l'administrateur ! <button onClick={() => setIsRegistering(false)} className="mt-4 w-full bg-white border border-green-300 py-2 rounded-lg font-bold">Retour à la connexion</button></div>
              ) : (
                <form onSubmit={async (e) => { e.preventDefault(); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'users_auth'), { pending: [...(usersConfig.pending || []), { name: String(regName), email: String(regEmail).toLowerCase().trim(), password: String(regPassword), requestDate: new Date().toLocaleDateString('fr-FR') }] }); setRegSuccess(true); }} className="space-y-4">
                  <input type="text" placeholder="Nom Prénom" className="w-full p-3 border rounded-xl bg-gray-50" value={regName} onChange={(e) => setRegName(e.target.value)} required />
                  <input type="email" placeholder="Email" className="w-full p-3 border rounded-xl bg-gray-50" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
                  <input type="password" placeholder="Mot de passe souhaité" className="w-full p-3 border rounded-xl bg-gray-50" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required />
                  <div className="flex gap-2"><button type="button" onClick={() => setIsRegistering(false)} className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-300">Annuler</button><button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700">Envoyer</button></div>
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 font-sans text-gray-800">
      <div className="max-w-[1400px] mx-auto">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-center bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-extrabold text-blue-900 tracking-tight flex items-center justify-center md:justify-start gap-2">
              Doccity Budget <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Cloud Actif</span>
            </h1>
            <p className="text-gray-500 font-medium text-sm md:text-base">Tableau de bord de gestion financière</p>
          </div>
          
          <div className="flex flex-wrap justify-center items-center gap-4">
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100 shadow-sm">
              <Calendar size={18} className="text-blue-600" />
              <label className="text-xs font-bold text-blue-900">Année :</label>
              <select 
                className="bg-transparent font-bold text-blue-900 outline-none cursor-pointer text-sm" 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              >
                {allYears.map(y => (
                  <option key={y} value={y}>
                    {y} {expensesPerYear[y] ? `(${expensesPerYear[y]} fact.)` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-white px-4 py-2 rounded-xl border flex items-center gap-4 shadow-sm">
              <div className="text-right leading-tight">
                <p className="text-sm font-bold text-gray-800">{currentUser.name}</p>
                <p className="text-xs text-blue-600 font-semibold">{currentUser.role}</p>
              </div>
              <button onClick={() => setCurrentUser(null)} className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"><LogOut size={20} /></button>
            </div>
          </div>
        </header>

        <nav className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: 'saisie', label: 'Saisie Dépenses', icon: <Plus size={18} /> },
            { id: 'import', label: 'Import CSV', icon: <Upload size={18} /> },
            { id: 'suivi', label: 'Suivi Mensuel', icon: <Search size={18} /> },
            { id: 'enveloppes', label: 'Matrice & Plafonds', icon: <Download size={18} /> },
            { id: 'configuration', label: 'Configuration', icon: <Settings size={18} /> },
            ...(currentUser.role === 'Administrateur' ? [{ id: 'admin', label: 'Administration', icon: <User size={18} /> }] : [])
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 whitespace-nowrap px-5 py-3 rounded-xl font-bold transition-all ${activeTab === t.id ? 'bg-blue-700 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-blue-50 hover:text-blue-700 shadow-sm'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>

        <main className="transition-all duration-300 relative">
          {activeTab === 'saisie' && <SaisieTab />}
          {activeTab === 'import' && <ImportTab />}
          {activeTab === 'suivi' && <SuiviTab />}
          {activeTab === 'enveloppes' && <EnveloppesTab />}
          {activeTab === 'configuration' && <ConfigurationTab />}
          {activeTab === 'admin' && <AdministrationTab />}
        </main>
      </div>
    </div>
  );
}