import { Response } from 'express';
import { ReportsService } from './reports.service';
export declare class ReportsController {
    private reports;
    constructor(reports: ReportsService);
    downloadNationalRisk(res: Response): Promise<void>;
}
