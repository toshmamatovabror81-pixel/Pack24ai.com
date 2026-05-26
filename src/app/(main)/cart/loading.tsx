// Cart page loading skeleton
export default function CartLoading() {
    return (
        <div className="min-h-screen bg-surface-page animate-pulse">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="h-3 bg-gray-200 rounded-full w-32 mb-6" />
                <div className="h-7 bg-gray-200 rounded-full w-36 mb-6" />
                <div className="flex flex-col xl:flex-row gap-6">
                    {/* Items */}
                    <div className="flex-1 space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-20 h-20 bg-gray-100 rounded-xl flex-shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-gray-200 rounded-full w-3/4" />
                                        <div className="h-3 bg-blue-100 rounded-full w-24" />
                                    </div>
                                    <div className="h-9 bg-gray-100 rounded-xl w-24" />
                                    <div className="h-5 bg-gray-200 rounded-full w-20" />
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Sidebar */}
                    <div className="xl:w-80 space-y-4">
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                            <div className="h-3 bg-gray-200 rounded-full w-24" />
                            <div className="h-9 bg-gray-100 rounded-xl" />
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                            <div className="h-4 bg-gray-200 rounded-full w-36 mb-4" />
                            <div className="h-3 bg-gray-100 rounded-full w-full" />
                            <div className="h-3 bg-gray-100 rounded-full w-4/5" />
                            <div className="border-t border-gray-100 pt-3 mt-2">
                                <div className="h-6 bg-blue-100 rounded-full w-32 ml-auto mb-4" />
                                <div className="h-12 bg-blue-100 rounded-xl" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
