import {
    CheckCircle2,
    CircleDollarSign,
    CreditCard,
    Headset,
    MapPinned,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    WalletCards,
} from "lucide-react";
import { motion } from "motion/react";

const sellingPoints = [
    {
        icon: CircleDollarSign,
        title: "Precios transparentes",
        desc: "Sin costos ocultos ni sorpresas",
    },
    {
        icon: Headset,
        title: "Atención personalizada",
        desc: "Te acompañamos antes y durante tu viaje",
    },
    {
        icon: MapPinned,
        title: "Viajes a tu medida",
        desc: "Diseñamos experiencias según tus gustos",
    },
    {
        icon: SlidersHorizontal,
        title: "Opciones para todos",
        desc: "Encuentra el viaje ideal para ti",
    },
];

const paymentMethods = [
    { name: "VISA", type: "visa" },
    { name: "mastercard", type: "mastercard" },
    { name: "AMEX", type: "amex" },
    { name: "Diners Club", type: "diners" },
    { name: "JCB", type: "jcb" },
    { name: "efecty", type: "efecty" },
    { name: "Bancolombia", type: "bancolombia" },
    { name: "nequi", type: "nequi" },
    { name: "DaviPlata", type: "daviplata" },
];

export default function WhyChooseUs() {
    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20 bg-background text-foreground transition-colors duration-300">

            {/* ENCABEZADO */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="text-center max-w-2xl mx-auto mb-10"
            >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-wide mb-4">
                    <Sparkles className="w-4 h-4" />
                    VIAJA CON CONFIANZA
                </div>

                <h2
                    className="text-foreground text-3xl md:text-4xl leading-tight font-medium"
                    style={{ fontFamily: "'Fraunces', serif" }}
                >
                    Todo lo que necesitas para{" "}
                    <span className="text-primary">
                        disfrutar tu viaje
                    </span>
                </h2>

                <p className="mt-3 text-muted-foreground text-sm md:text-base">
                    Nosotros nos encargamos de los detalles para que tú solo
                    tengas que preocuparte por disfrutar.
                </p>
            </motion.div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">

                {/* ================================
                    BLOQUE PRINCIPAL
                ================================= */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.65 }}
                    className="relative overflow-hidden rounded-[30px] p-7 md:p-10 border border-border bg-card shadow-lg"
                >

                    {/* Decoración utilizando el color primary de tu tema con baja opacidad */}
                    <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-primary/5 blur-2xl" />
                    <div className="absolute -left-20 -bottom-28 w-72 h-72 rounded-full bg-primary/5 blur-2xl" />

                    <div className="relative">

                        {/* Título */}
                        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-9">

                            <div>
                                <div className="flex items-center gap-2 text-primary text-xs font-bold tracking-[0.15em] uppercase mb-3">
                                    <span className="w-7 h-px bg-primary" />
                                    La diferencia Alik Tours
                                </div>

                                <h3
                                    className="text-card-foreground text-3xl md:text-[34px] leading-tight font-medium"
                                    style={{ fontFamily: "'Fraunces', serif" }}
                                >
                                    ¿Por qué viajar
                                    <br />
                                    con nosotros?
                                </h3>
                            </div>

                            <div className="hidden md:flex items-center gap-2 bg-secondary border border-border rounded-2xl px-4 py-3">
                                <ShieldCheck className="w-6 h-6 text-primary" />
                                <div>
                                    <strong className="block text-secondary-foreground text-xs">
                                        Viaja tranquilo
                                    </strong>
                                    <span className="text-muted-foreground text-[10px]">
                                        Estamos contigo
                                    </span>
                                </div>
                            </div>

                        </div>

                        {/* BENEFICIOS */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                            {sellingPoints.map((p, index) => (
                                <motion.div
                                    key={p.title}
                                    initial={{ opacity: 0, y: 15 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{
                                        duration: 0.45,
                                        delay: index * 0.08,
                                    }}
                                    whileHover={{
                                        y: -4,
                                        scale: 1.015,
                                    }}
                                    className="group relative rounded-2xl p-5 border border-border bg-background hover:bg-accent transition-all duration-300"
                                >

                                    <div className="flex items-start gap-4">

                                        {/* ICONO GRANDE */}
                                        <div className="shrink-0 w-14 h-14 rounded-2xl bg-muted border border-border flex items-center justify-center group-hover:bg-primary/10 transition-colors text-primary">
                                            <p.icon className="w-7 h-7" strokeWidth={1.8} />
                                        </div>

                                        <div className="pt-0.5">

                                            <h4 className="text-foreground font-bold text-[15px] leading-tight mb-1 group-hover:text-accent-foreground transition-colors">
                                                {p.title}
                                            </h4>

                                            <p className="text-muted-foreground text-xs leading-relaxed">
                                                {p.desc}
                                            </p>

                                        </div>

                                    </div>

                                    <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <CheckCircle2 className="w-4 h-4 text-primary" />
                                    </div>

                                </motion.div>
                            ))}

                        </div>

                        {/* CTA */}
                        <div className="mt-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t border-border">

                            <div className="flex items-center gap-3">

                                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <Headset className="w-4 h-4 text-primary" />
                                </div>

                                <div>
                                    <p className="text-foreground text-xs font-semibold">
                                        Atención humana
                                    </p>
                                    <p className="text-muted-foreground text-[10px]">
                                        Te ayudamos a elegir
                                    </p>
                                </div>

                            </div>

                            <button className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm px-5 py-3 rounded-xl transition-all duration-300 hover:-translate-y-0.5 shadow-md">
                                <Headset className="w-4 h-4" />
                                Habla con un asesor
                            </button>

                        </div>

                    </div>
                </motion.div>

                {/* ================================
                    PAGOS
                ================================= */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.65, delay: 0.1 }}
                    className="relative bg-card rounded-[30px] border border-border overflow-hidden shadow-lg"
                >

                    {/* Franja superior granate (primary) */}
                    <div className="h-1.5 bg-primary" />

                    <div className="p-7 md:p-8">

                        {/* Header pagos */}
                        <div className="flex items-start justify-between mb-7">

                            <div>

                                <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wide mb-2">
                                    <WalletCards className="w-4 h-4" />
                                    Pago fácil
                                </div>

                                <h3 className="text-card-foreground text-xl font-bold">
                                    Métodos de pago
                                </h3>

                                <p className="text-muted-foreground text-xs mt-1">
                                    Elige la opción que más te convenga.
                                </p>

                            </div>

                            <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
                                <CreditCard className="w-6 h-6 text-primary" />
                            </div>

                        </div>

                        {/* Logos */}
                        <div className="grid grid-cols-3 gap-3">

                            {paymentMethods.map((method) => (
                                <div
                                    key={method.name}
                                    className="h-14 rounded-xl border border-border bg-background flex items-center justify-center hover:border-primary/30 hover:bg-muted transition-all duration-300"
                                >

                                    {method.type === "visa" && (
                                        <span className="italic font-black text-xl tracking-tight text-[#1A1F71] dark:text-blue-400">
                                            VISA
                                        </span>
                                    )}

                                    {method.type === "mastercard" && (
                                        <div className="flex items-center">
                                            <span
                                                className="w-7 h-7 rounded-full"
                                                style={{ background: "#EB001B" }}
                                            />
                                            <span
                                                className="w-7 h-7 rounded-full -ml-3 opacity-90"
                                                style={{ background: "#F79E1B" }}
                                            />
                                        </div>
                                    )}

                                    {method.type === "amex" && (
                                        <span className="text-white text-[10px] font-bold px-2.5 py-1.5 rounded bg-[#016FD0]">
                                            AMEX
                                        </span>
                                    )}

                                    {method.type === "diners" && (
                                        <span className="text-[12px] font-bold text-[#0079BE] dark:text-blue-400">
                                            Diners Club
                                        </span>
                                    )}

                                    {method.type === "jcb" && (
                                        <span className="text-[14px] font-black italic text-[#0B4EA2] dark:text-blue-500">
                                            JCB
                                        </span>
                                    )}

                                    {method.type === "efecty" && (
                                        <span className="text-[15px] font-black italic text-[#E30613] dark:text-red-500">
                                            efecty
                                        </span>
                                    )}

                                    {method.type === "bancolombia" && (
                                        <span className="text-[10px] font-bold text-foreground">
                                            Bancolombia
                                        </span>
                                    )}

                                    {method.type === "nequi" && (
                                        <span className="text-[16px] font-black italic text-[#DB0270] dark:text-pink-500">
                                            nequi
                                        </span>
                                    )}

                                    {method.type === "daviplata" && (
                                        <span className="text-[11px] font-bold text-[#EE1C25] dark:text-red-500">
                                            DaviPlata
                                        </span>
                                    )}

                                </div>
                            ))}

                        </div>

                        {/* Beneficios pago */}
                        <div className="mt-6 space-y-3">

                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                                    <ShieldCheck className="w-4 h-4 text-primary" />
                                </div>

                                <div>
                                    <strong className="block text-foreground text-xs">
                                        Pago seguro
                                    </strong>
                                    <span className="text-muted-foreground text-[10px]">
                                        Tus datos están protegidos
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                                    <CircleDollarSign className="w-4 h-4 text-primary" />
                                </div>

                                <div>
                                    <strong className="block text-foreground text-xs">
                                        Diferentes formas de pago
                                    </strong>
                                    <span className="text-muted-foreground text-[10px]">
                                        Paga como prefieras
                                    </span>
                                </div>
                            </div>

                        </div>

                        {/* Cuotas */}
                        <div className="mt-6 rounded-2xl p-4 flex items-center justify-between bg-secondary border border-border">

                            <div>
                                <span className="block text-primary text-[10px] font-bold uppercase tracking-wide">
                                    Facilidades de pago
                                </span>

                                <strong className="text-secondary-foreground text-sm">
                                    Hasta 12 cuotas*
                                </strong>
                            </div>

                            <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center shadow-sm">
                                <CreditCard className="w-5 h-5 text-primary" />
                            </div>

                        </div>

                        <p className="text-[9px] text-muted-foreground mt-3">
                            *Sujeto a condiciones de la entidad financiera.
                        </p>

                    </div>
                </motion.div>

            </div>
        </section>
    );
}