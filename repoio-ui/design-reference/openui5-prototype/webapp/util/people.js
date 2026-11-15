/* Sample people directory for the prototype. In the product this comes from the user API (Entra ID). */
sap.ui.define([], function () {
	"use strict";
	var P = {
		"محمد": { initials: "MM", en: "Mohamed", role_ar: "مدير إدارة البيانات والتحليلات", role_en: "Data Management & Analytics Manager", team_ar: "إدارة البيانات", team_en: "Data Management", email: "mohamed@example.com", phone: "+20 2 0000 0101" },
		"سارة عادل": { initials: "SA", en: "Sara Adel", role_ar: "أمينة بيانات العملاء", role_en: "Customer data steward", team_ar: "المبيعات والتسويق", team_en: "Sales / Marketing", email: "sara.adel@example.com", phone: "+20 2 0000 0102" },
		"أحمد ناصر": { initials: "AN", en: "Ahmed Nasser", role_ar: "مهندس بيانات", role_en: "Data engineer", team_ar: "إدارة البيانات", team_en: "Data Management", email: "ahmed.nasser@example.com", phone: "+20 2 0000 0103" },
		"هالة سمير": { initials: "HS", en: "Hala Samir", role_ar: "أمينة بيانات الموردين والشركاء", role_en: "Vendor and partner data steward", team_ar: "المشتريات", team_en: "Procurement", email: "hala.samir@example.com", phone: "+20 2 0000 0104" },
		"كريم فوزي": { initials: "KF", en: "Karim Fawzy", role_ar: "أمين بيانات المنتجات", role_en: "Product data steward", team_ar: "النشر", team_en: "Publishing", email: "karim.fawzy@example.com", phone: "+20 2 0000 0105" },
		"نور الدين": { initials: "ND", en: "Nour El-Din", role_ar: "محلل بيانات", role_en: "Data analyst", team_ar: "النشر", team_en: "Publishing", email: "nour.eldin@example.com", phone: "+20 2 0000 0106" },
		"عمر طارق": { initials: "OT", en: "Omar Tarek", role_ar: "أمين بيانات الموردين", role_en: "Vendor data steward", team_ar: "المشتريات", team_en: "Procurement", email: "omar.tarek@example.com", phone: "+20 2 0000 0107" },
		"منى حسن": { initials: "MH", en: "Mona Hassan", role_ar: "مالكة بيانات الموظفين", role_en: "Employee data owner", team_ar: "الموارد البشرية", team_en: "HR", email: "mona.hassan@example.com", phone: "+20 2 0000 0108" },
		"ياسر جمال": { initials: "YG", en: "Yasser Gamal", role_ar: "مالك بيانات المتاجر", role_en: "Store data owner", team_ar: "التجزئة", team_en: "Retail", email: "yasser.gamal@example.com", phone: "+20 2 0000 0109" },
		"ليلى منصور": { initials: "LM", en: "Laila Mansour", role_ar: "مديرة التحرير", role_en: "Editorial director", team_ar: "التحرير", team_en: "Editorial", email: "laila.mansour@example.com", phone: "+20 2 0000 0110" },
		"طارق عبد الله": { initials: "TA", en: "Tarek Abdallah", role_ar: "مدير حسابات كبار العملاء", role_en: "Key account manager", team_ar: "عمليات المبيعات", team_en: "Sales operations", email: "tarek.abdallah@example.com", phone: "+20 2 0000 0111" },
		"دينا فاروق": { initials: "DF", en: "Dina Farouk", role_ar: "أخصائية حملات", role_en: "Campaign specialist", team_ar: "التسويق", team_en: "Marketing", email: "dina.farouk@example.com", phone: "+20 2 0000 0112" },
		"مصطفى علي": { initials: "MA", en: "Mostafa Ali", role_ar: "مهندس منصات", role_en: "Platform engineer", team_ar: "تكنولوجيا المعلومات", team_en: "IT", email: "mostafa.ali@example.com", phone: "+20 2 0000 0113" },
		"رانيا يوسف": { initials: "RY", en: "Rania Youssef", role_ar: "منسقة الحقوق", role_en: "Rights coordinator", team_ar: "التحرير", team_en: "Editorial", email: "rania.youssef@example.com", phone: "+20 2 0000 0114" },
		"حسام الدين": { initials: "HD", en: "Hossam El-Din", role_ar: "محلل بيانات العملاء", role_en: "Customer data analyst", team_ar: "عمليات المبيعات", team_en: "Sales operations", email: "hossam.eldin@example.com", phone: "+20 2 0000 0115" },
		"إيمان سعيد": { initials: "ES", en: "Eman Said", role_ar: "مسؤولة مشتريات", role_en: "Procurement officer", team_ar: "المشتريات", team_en: "Procurement", email: "eman.said@example.com", phone: "+20 2 0000 0116" },
		"شريف لطفي": { initials: "SL", en: "Sherif Lotfy", role_ar: "استشاري خارجي", role_en: "External consultant", team_ar: "إدارة البيانات", team_en: "Data Management", email: "sherif.lotfy@example.com", phone: "+20 2 0000 0117" }
	};
	return {
		get: function (name) { return P[name]; },
		names: function () { return Object.keys(P); },
		/* Add a person created in the console (manual fallback, ADR-0009) so avatars and quick views work for them. */
		add: function (name, o) { if (!P[name]) { P[name] = o; } }
	};
});
