export type BoxDimensions = {
    l: number;
    w: number;
    h: number;
};

export type BoxSizeInput = {
    l: string;
    w: string;
    h: string;
};

export type Material = {
    id: string;
    name: string;
    thickness: number; // in mm
    color: string;
    pricePerSqMeter: number; // UZS per m2
};

export interface BoxModelProps {
    dimensions: BoxDimensions;
    material: Material;
    foldProgress: number; // 0 to 1
    t?: (key: string) => string; // Translation function
    textureUrl?: string; // Custom texture URL for AI Design
    logoUrl?: string; // Optional mock/logo URL
}

export interface BoxModel {
    id: string;
    name: string;
    description: string;
    validate: (dims: BoxDimensions) => { valid: boolean; error?: string };
    // The component that renders the 3D model
    Model3D: React.FC<BoxModelProps>;
    // The component that renders the 2D layout
    Layout2D: React.FC<BoxModelProps>;
    // Function to generate and download PDF
    downloadPDF: (dims: BoxDimensions, t: (key: string) => string) => void;
    // Calculate total sheet area in m2 for pricing
    calculateArea: (dims: BoxDimensions) => number;
}
