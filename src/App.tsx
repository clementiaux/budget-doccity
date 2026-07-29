import React, { useState, useMemo, useEffect } from 'react';
import { Download, Edit2, Trash2, Plus, Settings, Save, X, Search, ArrowUpDown, LogOut, User } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, addDoc } from 'firebase/firestore';

// @ts-ignore
const envConfig = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
const providedConfig = {
  apiKey: "AIzaSyC8UXwghqNCTJc703ZICZj3-_yZ9t9PntY",
  authDomain: "budget-marseille.firebaseapp.com",
  projectId: "budget-marseille",
  storageBucket: "budget-marseille.firebasestorage.app",
  messagingSenderId: "580135397481",
  appId: "1:580135397481:web:0b8aa26a9c73f34c5e9af8",
  measurementId: "G-Z2TM6BVKER"
};

const firebaseConfig = envConfig ? JSON.parse(envConfig) : providedConfig;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// @ts-ignore
const appId = typeof __app_id !== 'undefined' ? __app_id : 'budget-marseille';

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
  // Interface Auth states
  const [currentUser, setCurrentUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  // Cloud Auth & Loading states
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isDBReady, setIsDBReady] = useState(false);

  // Users config states
  const [usersConfig, setUsersConfig] = useState({ users: [], pending: [] });
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);

  const allowedUsers = [
    { email: 'direction@doccity.fr', password: 'doccity2026', name: 'Direction', role: 'Administrateur' },
    { email: 'compta@doccity.fr', password: 'doccity2026', name: 'Service Comptabilité', role: 'Éditeur' }
  ];

  const [activeTab, setActiveTab] = useState('saisie');
  
  // Database states
  const [expenses, setExpenses] = useState([]);
  const [envelopes, setEnvelopes] = useState([]);
  const [subCategoriesMap, setSubCategoriesMap] = useState({});

  useEffect(() => {
    const initAuth = async () => {
      // @ts-ignore
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        // @ts-ignore
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFirebaseUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    // Listen to Budget Configuration (Envelopes and SubCategories)
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'budget_setup');
    const unsubConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setEnvelopes(data.envelopes || []);
        setSubCategoriesMap(data.subCategoriesMap || {});
        setIsDBReady(true);
      } else {
        // Initialize with default values on first launch
        setDoc(configRef, { envelopes: DEFAULT_ENVELOPES, subCategoriesMap: DEFAULT_SUB_CATEGORIES });
      }
    }, (error) => console.error("Cloud Config Error:", error));

    // Listen to Expenses
    const expensesRef = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');
    const unsubExpenses = onSnapshot(expensesRef, (snapshot) => {
      const expData = [];
      snapshot.forEach(docSnap => expData.push({ id: docSnap.id, ...docSnap.data() }));
      setExpenses(expData);
    }, (error) => console.error("Cloud Expenses Error:", error));

    // Listen to Users (for custom auth and approval)
    const usersAuthRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'users_auth');
    const unsubUsers = onSnapshot(usersAuthRef, (docSnap) => {
      if (docSnap.exists()) {
        setUsersConfig(docSnap.data());
      } else {
        setDoc(usersAuthRef, { users: [], pending: [] });
      }
    }, (error) => console.error("Cloud Users Error:", error));

    return () => {
      unsubConfig();
      unsubExpenses();
      unsubUsers();
    };
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
    const [editId, setEditId] = useState(null);

    const [filterCat, setFilterCat] = useState('');
    const [filterSub, setFilterSub] = useState('');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [sortField, setSortField] = useState('date');
    const [sortOrder, setSortOrder] = useState('desc'); 

    const handleAddOrEdit = async (e) => {
      e.preventDefault();
      if (!desc || !amount || !date || !cat) return;
      
      const payload = { date, description: desc, amount: parseFloat(amount), categoryId: cat, subCategory: sub };
      
      if (editId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', editId), payload);
        setEditId(null);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), payload);
      }
      setDesc(''); setAmount(''); setDate('');
    };

    const handleEditClick = (expense) => {
      setDesc(expense.description);
      setDate(expense.date);
      setCat(expense.categoryId);
      setSub(expense.subCategory);
      setAmount(expense.amount);
      setEditId(expense.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteClick = async (id) => {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', id));
    };

    let filtered = expenses.filter(ex => {
      if (filterCat && ex.categoryId !== filterCat) return false;
      if (filterSub && ex.subCategory !== filterSub) return false;
      if (minAmount && ex.amount < parseFloat(minAmount)) return false;
      if (maxAmount && ex.amount > parseFloat(maxAmount)) return false;
      return true;
    });

    filtered.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (sortField === 'date') { valA = new Date(valA).getTime(); valB = new Date(valB).getTime(); }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const exportCSV = () => {
      const headers = ['Date', 'Description', 'Catégorie', 'Sous-Catégorie', 'Montant'];
      const rows = filtered.map(ex => `"${ex.date}";"${ex.description.replace(/"/g, '""')}";"${ex.categoryId}";"${ex.subCategory}";"${ex.amount}"`);
      const csvContent = [headers.join(';'), ...rows].join('\n');
      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "depenses.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <div className="space-y-6">
        <form onSubmit={handleAddOrEdit} className={`p-6 rounded-xl border shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4 ${editId ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
          <div className="col-span-full mb-2 font-bold text-gray-700 flex justify-between">
            {editId ? 'Modifier la dépense' : 'Saisir une nouvelle dépense'}
            {editId && <button type="button" onClick={() => {setEditId(null); setDesc(''); setAmount(''); setDate('');}} className="text-red-500 text-sm">Annuler la modification</button>}
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
          <button className={`${editId ? 'bg-green-600' : 'bg-blue-600'} text-white p-2 rounded col-span-full font-bold flex justify-center items-center gap-2`}>
            {editId ? <Save size={18} /> : <Plus size={18} />}
            {editId ? 'Mettre à jour' : 'Ajouter Dépense'}
          </button>
        </form>

        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex flex-col md:flex-row justify-between mb-4 gap-4 items-center">
            <h2 className="font-bold text-lg">Historique partagé des saisies</h2>
            <button onClick={exportCSV} className="bg-green-100 text-green-700 px-4 py-2 rounded font-semibold flex items-center gap-2 hover:bg-green-200 transition-colors">
              <Download size={18} /> Exporter CSV
            </button>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mb-4 grid grid-cols-1 md:grid-cols-4 gap-4 border">
            <div>
              <label className="text-xs text-gray-500 font-semibold mb-1 block">Filtrer par Catégorie</label>
              <select className="border p-2 rounded w-full bg-white" value={filterCat} onChange={(e) => {setFilterCat(e.target.value); setFilterSub('');}}>
                <option value="">Toutes les catégories</option>
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
              <label className="text-xs text-gray-500 font-semibold mb-1 block">Montant min (€)</label>
              <input type="number" className="border p-2 rounded w-full bg-white" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold mb-1 block">Montant max (€)</label>
              <input type="number" className="border p-2 rounded w-full bg-white" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left cursor-pointer hover:bg-gray-200" onClick={() => { setSortField('date'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                    Date {sortField === 'date' && <ArrowUpDown size={14} className="inline" />}
                  </th>
                  <th className="p-3 text-left">Description</th>
                  <th className="p-3 text-left">Catégorie & Sous-Catégorie</th>
                  <th className="p-3 text-right cursor-pointer hover:bg-gray-200" onClick={() => { setSortField('amount'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}>
                    Montant {sortField === 'amount' && <ArrowUpDown size={14} className="inline" />}
                  </th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ex => (
                  <tr key={ex.id} className={`border-b hover:bg-gray-50 transition-colors ${editId === ex.id ? 'bg-blue-50' : ''}`}>
                    <td className="p-3 whitespace-nowrap">{new Date(ex.date).toLocaleDateString('fr-FR')}</td>
                    <td className="p-3">{ex.description}</td>
                    <td className="p-3 text-gray-600"><span className="font-semibold text-gray-800">{ex.categoryId}</span> <br/> {ex.subCategory}</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(ex.amount)}</td>
                    <td className="p-3 text-center">
                      <button onClick={() => handleEditClick(ex)} className="text-blue-600 p-1 mx-1 hover:bg-blue-100 rounded transition-colors"><Edit2 size={16} /></button>
                      <button onClick={() => handleDeleteClick(ex.id)} className="text-red-600 p-1 mx-1 hover:bg-red-100 rounded transition-colors"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan="5" className="p-4 text-center text-gray-500">Aucune dépense trouvée avec ces filtres.</td></tr>}
              </tbody>
            </table>
          </div>
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
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'users_auth'), {
        pending: newPending,
        users: newUsers
      });
    };

    const executeReject = async (email) => {
      const newPending = usersConfig.pending.filter(u => u.email !== email);
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'users_auth'), {
        pending: newPending
      });
      setRequestToReject(null);
    };

    const executeDeleteUser = async (email) => {
      const newUsers = usersConfig.users.filter(u => u.email !== email);
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'users_auth'), {
        users: newUsers
      });
      setUserToDelete(null);
    };

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h2 className="font-bold text-lg mb-4 text-orange-600 flex items-center gap-2">
            Demandes d'accès en attente ({usersConfig.pending?.length || 0})
          </h2>
          {usersConfig.pending?.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucune demande en attente.</p>
          ) : (
            <div className="space-y-3">
              {usersConfig.pending?.map((u, i) => (
                <div key={i} className="flex items-center justify-between bg-orange-50 p-4 rounded-lg border border-orange-100">
                  <div>
                    <p className="font-bold text-gray-800">{u.name}</p>
                    <p className="text-sm text-gray-600">{u.email}</p>
                    <p className="text-xs text-gray-400 mt-1">Date de demande : {u.requestDate}</p>
                  </div>
                  <div className="flex gap-2">
                    {requestToReject === u.email ? (
                      <>
                        <button onClick={() => setRequestToReject(null)} className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded font-semibold hover:bg-gray-300 transition-colors">Annuler</button>
                        <button onClick={() => executeReject(u.email)} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded font-bold hover:bg-red-700 transition-colors">Confirmer refus</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setRequestToReject(u.email)} className="px-3 py-1.5 text-sm bg-white text-red-600 border border-red-200 rounded font-semibold hover:bg-red-50 transition-colors">Refuser</button>
                        <button onClick={() => handleAccept(u)} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded font-bold hover:bg-green-700 shadow-sm transition-colors">Accepter</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h2 className="font-bold text-lg mb-4 text-blue-900">Utilisateurs enregistrés et autorisés</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100">
                <tr><th className="p-3">Nom</th><th className="p-3">Email</th><th className="p-3">Rôle</th><th className="p-3">Actions</th></tr>
              </thead>
              <tbody>
                {/* Utilisateurs codés en dur */}
                {allowedUsers.map(u => (
                  <tr key={u.email} className="border-b bg-gray-50">
                    <td className="p-3 font-semibold">{u.name}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3"><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">{u.role}</span></td>
                    <td className="p-3 text-gray-400 text-xs italic">Compte système</td>
                  </tr>
                ))}
                {/* Utilisateurs inscrits de la base de données */}
                {usersConfig.users?.map((u, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-semibold">{u.name}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3"><span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">{u.role}</span></td>
                    <td className="p-3">
                      {userToDelete === u.email ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-600 font-bold">Confirmer ?</span>
                          <button onClick={() => executeDeleteUser(u.email)} className="bg-red-600 text-white p-1 rounded hover:bg-red-700 transition-colors" title="Confirmer la suppression"><Trash2 size={16} /></button>
                          <button onClick={() => setUserToDelete(null)} className="bg-gray-200 text-gray-700 p-1 rounded hover:bg-gray-300 transition-colors" title="Annuler"><X size={16} /></button>
                        </div>
                      ) : (
                        <button onClick={() => setUserToDelete(u.email)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded transition-colors" title="Supprimer l'utilisateur"><Trash2 size={16} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4 font-sans text-gray-800">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
          <div className="text-center mb-8 mt-2">
            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-blue-100">
              <User size={32} className="text-blue-600" />
            </div>
            <h1 className="text-2xl font-extrabold text-blue-900 tracking-tight mb-1">Doccity Budget</h1>
            <p className="text-gray-500 text-sm">Espace collaboratif partagé</p>
          </div>

          {!isRegistering ? (
            <>
              <form onSubmit={(e) => {
                e.preventDefault();
                // Combiner les utilisateurs système et les utilisateurs base de données
                const allUsers = [...allowedUsers, ...(usersConfig.users || [])];
                const user = allUsers.find(u => u.email.toLowerCase() === loginEmail.toLowerCase().trim() && u.password === loginPassword);
                
                if (user) {
                  setCurrentUser(user);
                  setLoginError(false);
                  setLoginPassword(''); 
                } else {
                  setLoginError(true);
                }
              }} className="space-y-4">
                <div>
                  <input
                    type="email"
                    placeholder="Adresse email"
                    className={`w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-600 transition-all mb-4 shadow-sm ${loginError ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    autoFocus
                  />
                  <input
                    type="password"
                    placeholder="Mot de passe"
                    className={`w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-sm ${loginError ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                  {loginError && <p className="text-red-500 text-xs mt-3 font-semibold text-center bg-red-50 p-2 rounded">Email ou mot de passe incorrect</p>}
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg active:scale-[0.98]">
                  Se connecter
                </button>
              </form>
              
              <div className="mt-6 text-center">
                <button onClick={() => { setIsRegistering(true); setRegSuccess(false); }} className="text-sm font-semibold text-blue-600 hover:underline">
                  Demander un accès (Nouvel utilisateur)
                </button>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-500 flex flex-col gap-2">
                <p className="font-semibold text-center text-gray-600 mb-1">Comptes d'administration :</p>
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100 flex justify-between">
                  <span className="font-medium">direction@doccity.fr</span>
                  <span>doccity2026</span>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {regSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-center text-sm font-medium">
                  Demande envoyée avec succès ! <br/><br/>
                  L'administrateur a été notifié par email. Vous pourrez vous connecter dès que votre compte sera validé.
                  <button onClick={() => setIsRegistering(false)} className="mt-4 w-full bg-white border border-green-300 text-green-700 py-2 rounded-lg font-bold hover:bg-green-100">
                    Retour à la connexion
                  </button>
                </div>
              ) : (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!regName || !regEmail || !regPassword) return;
                  
                  // Ajouter à la liste d'attente sur Firestore
                  const newPending = [...(usersConfig.pending || []), { 
                    name: regName, 
                    email: regEmail.toLowerCase().trim(), 
                    password: regPassword,
                    requestDate: new Date().toLocaleDateString('fr-FR')
                  }];
                  await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'users_auth'), {
                    pending: newPending
                  });

                  setRegSuccess(true);
                  
                  // Préparer l'email pour notifier l'administrateur
                  const subject = encodeURIComponent("Nouvelle demande d'accès - Doccity Budget");
                  const body = encodeURIComponent(`Bonjour,\n\nUne nouvelle personne souhaite accéder à l'application Doccity Budget :\n\nNom : ${regName}\nEmail : ${regEmail}\n\nMerci de vous connecter sur l'application avec le compte direction@doccity.fr et de vous rendre dans le nouvel onglet "Administration" pour valider ou refuser cet accès.\n\nCordialement.`);
                  window.location.href = `mailto:l.clementiaux@doc-city.fr?subject=${subject}&body=${body}`;
                  
                }} className="space-y-4">
                  <p className="text-sm text-gray-600 text-center mb-4 font-medium">Veuillez remplir ce formulaire. L'administrateur devra valider votre compte.</p>
                  <input type="text" placeholder="Nom complet" className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-600 bg-gray-50" value={regName} onChange={(e) => setRegName(e.target.value)} required />
                  <input type="email" placeholder="Adresse email" className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-600 bg-gray-50" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
                  <input type="password" placeholder="Créer un mot de passe" className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-600 bg-gray-50" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required />
                  
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setIsRegistering(false)} className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors">
                      Annuler
                    </button>
                    <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-md">
                      Envoyer demande
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Waiting for cloud data to sync
  if (!isDBReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center text-blue-600 bg-white p-8 rounded-2xl shadow-sm border">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-blue-600 mb-4"></div>
          <p className="font-bold text-gray-700">Synchronisation avec le Cloud...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-gray-800">
      <div className="max-w-[1400px] mx-auto">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-900 tracking-tight mb-1 flex items-center gap-3">
              Doccity Budget 
              <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold border border-green-200 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span> Cloud Actif
              </span>
            </h1>
            <p className="text-gray-500 font-medium">Tableau de bord de gestion financière partagé</p>
          </div>
          
          <div className="bg-gray-50 px-5 py-3 rounded-xl border border-gray-200 flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold text-gray-800">{currentUser.name}</p>
              <p className="text-xs text-blue-600 font-semibold">{currentUser.role}</p>
            </div>
            <div className="w-px h-8 bg-gray-300"></div>
            <button 
              onClick={() => setCurrentUser(null)} 
              className="text-gray-500 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
              title="Se déconnecter"
            >
              <LogOut size={20} />
            </button>
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
            <button 
              key={t.id} 
              onClick={() => setActiveTab(t.id)} 
              className={`flex items-center gap-2 whitespace-nowrap px-6 py-3.5 rounded-xl font-bold transition-all shadow-sm ${
                activeTab === t.id 
                ? 'bg-blue-700 text-white shadow-md' 
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </nav>

        <main className="transition-all duration-300 ease-in-out">
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