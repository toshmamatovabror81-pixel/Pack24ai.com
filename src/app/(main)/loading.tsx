export default function MainLoading() {
    return (
        <div className="min-h-[60vh] flex items-center justify-center bg-surface-page">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500 font-medium">Yuklanmoqda...</p>
            </div>
        </div>
    );
}
