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
		"ياسر جمال": { initials: "YG", en: "Yasser Gamal", role_ar: "مالك بيانات المتاجر", role_en: "Store data owner", team_ar: "التجزئة", team_en: "Retail", email: "yasser.gamal@example.com", phone: "+20 2 0000 0109" }
	};
	return { get: function (name) { return P[name]; } };
});
