// Product page loading skeleton — Next.js App Router
export default function ProductLoading() {
    return (
        <div className="min-h-screen bg-surface-page animate-pulse">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="h-3 bg-gray-200 rounded-full w-64 mb-6" />
            </div>
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px_240px] gap-8">
                        {/* Image skeleton */}
                        <div className="space-y-3">
                            <div className="h-80 bg-gray-100 rounded-2xl" />
                            <div className="flex gap-2">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="w-16 h-16 bg-gray-100 rounded-xl flex-shrink-0" />
                                ))}
                            </div>
                        </div>
                        {/* Info skeleton */}
                        <div className="space-y-4 pt-2">
                            <div className="h-3 bg-gray-100 rounded-full w-28" />
                            <div className="h-7 bg-gray-200 rounded-full w-3/4" />
                            <div className="h-4 bg-gray-100 rounded-full w-36" />
                            <div className="h-20 bg-blue-50 rounded-2xl" />
                            <div className="flex gap-3">
                                <div className="h-11 bg-gray-100 rounded-xl w-28" />
                                <div className="h-11 bg-blue-100 rounded-xl flex-1" />
                                <div className="h-11 bg-gray-100 rounded-xl w-11" />
                            </div>
                            <div className="h-11 bg-gray-100 rounded-xl" />
                            <div className="grid grid-cols-2 gap-2">
                                <div className="h-10 bg-gray-50 rounded-xl" />
                                <div className="h-10 bg-gray-50 rounded-xl" />
                            </div>
                        </div>
                        {/* Sticky panel skeleton */}
                        <div className="hidden xl:block space-y-3 pt-2">
                            <div className="h-4 bg-gray-100 rounded-full w-full" />
                            <div className="h-8 bg-blue-50 rounded-xl w-3/4" />
                            <div className="h-11 bg-blue-100 rounded-xl" />
                            <div className="h-11 bg-gray-100 rounded-xl" />
                            <div className="grid grid-cols-2 gap-2">
                                <div className="h-9 bg-gray-50 rounded-xl" />
                                <div className="h-9 bg-gray-50 rounded-xl" />
                            </div>
                        </div>
                    </div>
                    {/* Tabs skeleton */}
                    <div className="border-t border-gray-100 mt-6 pt-4">
                        <div className="flex gap-6 mb-5">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-4 bg-gray-100 rounded-full w-20" />
                            ))}
                        </div>
                        <div className="space-y-2">
                            <div className="h-3 bg-gray-100 rounded-full w-full" />
                            <div className="h-3 bg-gray-100 rounded-full w-4/5" />
                            <div className="h-3 bg-gray-100 rounded-full w-2/3" />
                        </div>
                    </div>
                </div>
                {/* Related products skeleton */}
                <div className="mt-10">
                    <div className="h-6 bg-gray-200 rounded-full w-48 mb-5" />
                    <div className="flex gap-4 overflow-hidden">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex-shrink-0 w-48 bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                <div className="h-36 bg-gray-100" />
                                <div className="p-3 space-y-2">
                                    <div className="h-3 bg-gray-100 rounded-full w-full" />
                                    <div className="h-3 bg-gray-100 rounded-full w-2/3" />
                                    <div className="h-4 bg-blue-50 rounded-full w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
